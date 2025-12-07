import os
import json
import tempfile
import base64
from pathlib import Path
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import numpy as np
import pandas as pd
from yt_dlp import YoutubeDL
import librosa
from flask_cors import CORS

# NEW google-genai package (not google-generativeai)
from google import genai
from google.genai import types

# Spotify integration
from spotify_integration import spotify_bp

load_dotenv()

app = Flask(__name__)

# Register Spotify blueprint
app.register_blueprint(spotify_bp, url_prefix='/api/spotify')

# Secret key for sessions (needed for OAuth)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-prod")

CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True
)

# Configure Gemini client (new google-genai package)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# =========================
# Audio Analysis Functions
# =========================

def download_audio_from_youtube(url: str, out_dir: Path) -> tuple[Path, dict]:
    """Download best audio from YouTube and return path + metadata."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out_tmpl = str(out_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "noplaylist": True,
        "quiet": True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)

    metadata = {
        "title": info.get("title", "Unknown"),
        "artist": info.get("artist") or info.get("uploader", "Unknown Artist"),
        "duration": info.get("duration", 0),
        "thumbnail": info.get("thumbnail", ""),
    }

    return Path(filename), metadata


def safe_entropy(p: np.ndarray, eps: float = 1e-9) -> float:
    """Shannon entropy of a probability vector p (base 2)."""
    p = np.asarray(p, dtype=float)
    p = p / (p.sum() + eps)
    return float(-(p * np.log2(p + eps)).sum())


def extract_frame_features(y_frame: np.ndarray, sr: int) -> dict:
    """Extract per-1-second frame features."""
    if len(y_frame) == 0:
        return {
            "rms": 0.0, "centroid": 0.0, "bandwidth": 0.0, "zcr": 0.0,
            "onset_strength": 0.0, "spectral_flatness": 0.0,
            "percussive_ratio": 0.0, "tonal_tension": 0.0,
            "low_mid_energy_ratio": 0.0, "chroma_entropy": 0.0,
        }

    S = np.abs(librosa.stft(y_frame, n_fft=2048, hop_length=512))
    rms = librosa.feature.rms(S=S).mean()
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr).mean()
    bandwidth = librosa.feature.spectral_bandwidth(S=S, sr=sr).mean()
    zcr = librosa.feature.zero_crossing_rate(y_frame).mean()
    flatness = librosa.feature.spectral_flatness(S=S).mean()
    onset_strength = librosa.onset.onset_strength(y=y_frame, sr=sr).mean()

    y_h, y_p = librosa.effects.hpss(y_frame)
    mean_h = np.mean(np.abs(y_h))
    mean_p = np.mean(np.abs(y_p))
    percussive_ratio = float(mean_p / (mean_h + mean_p + 1e-9))

    try:
        tonnetz = librosa.feature.tonnetz(y=y_h, sr=sr)
        tonal_tension = float(np.linalg.norm(tonnetz, axis=0).mean())
    except Exception:
        tonal_tension = 0.0

    mel = librosa.feature.melspectrogram(y=y_frame, sr=sr, n_mels=40, fmax=8000)
    mel_energy = mel.sum(axis=1)
    total_energy = float(mel_energy.sum() + 1e-9)
    low_mid_energy = float(mel_energy[:10].sum())
    low_mid_energy_ratio = low_mid_energy / total_energy

    chroma = librosa.feature.chroma_stft(y=y_h, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    chroma_entropy = safe_entropy(chroma_mean)

    return {
        "rms": float(rms), "centroid": float(centroid),
        "bandwidth": float(bandwidth), "zcr": float(zcr),
        "onset_strength": float(onset_strength),
        "spectral_flatness": float(flatness),
        "percussive_ratio": float(percussive_ratio),
        "tonal_tension": float(tonal_tension),
        "low_mid_energy_ratio": float(low_mid_energy_ratio),
        "chroma_entropy": float(chroma_entropy),
    }


def norm_series(s: pd.Series) -> pd.Series:
    """Min-max normalize a series to [0, 1]."""
    s_min, s_max = float(s.min()), float(s.max())
    if s_max == s_min:
        return pd.Series(0.5, index=s.index)
    return (s - s_min) / (s_max - s_min)


def features_to_axes(df: pd.DataFrame) -> pd.DataFrame:
    """Compute the 6 emotional axes from features."""
    for col in ["rms", "centroid", "bandwidth", "zcr", "onset_strength",
                "spectral_flatness", "percussive_ratio", "tonal_tension",
                "low_mid_energy_ratio", "chroma_entropy"]:
        df[f"{col}_norm"] = norm_series(df[col])

    energy = 0.6 * df["rms_norm"] + 0.3 * df["onset_strength_norm"] + 0.1 * df["zcr_norm"]
    valence = (0.4 * (1.0 - df["centroid_norm"]) + 0.2 * (1.0 - df["tonal_tension_norm"]) +
               0.3 * df["low_mid_energy_ratio_norm"] + 0.1 * (1.0 - df["spectral_flatness_norm"]))
    tension = 0.5 * df["tonal_tension_norm"] + 0.3 * df["spectral_flatness_norm"] + 0.2 * df["onset_strength_norm"]
    warmth = (0.5 * df["low_mid_energy_ratio_norm"] + 0.3 * (1.0 - df["centroid_norm"]) +
              0.2 * (1.0 - df["percussive_ratio_norm"]))
    power = 0.6 * df["rms_norm"] + 0.2 * df["percussive_ratio_norm"] + 0.2 * df["low_mid_energy_ratio_norm"]
    complexity = 0.5 * df["chroma_entropy_norm"] + 0.3 * df["spectral_flatness_norm"] + 0.2 * df["zcr_norm"]

    return pd.DataFrame({
        "time_sec": df["time_sec"],
        "valence": valence.clip(0.0, 1.0),
        "energy": energy.clip(0.0, 1.0),
        "tension": tension.clip(0.0, 1.0),
        "warmth": warmth.clip(0.0, 1.0),
        "power": power.clip(0.0, 1.0),
        "complexity": complexity.clip(0.0, 1.0),
    })


def analyze_audio(url: str, snippet_seconds: int = 45) -> tuple[pd.DataFrame, dict]:
    """Main analysis pipeline."""
    with tempfile.TemporaryDirectory() as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        audio_path, metadata = download_audio_from_youtube(url, tmpdir)

        TARGET_SR = 22050
        y, sr = librosa.load(str(audio_path), sr=TARGET_SR, mono=True, duration=snippet_seconds)

        total_sec = min(snippet_seconds, int(np.floor(len(y) / sr)))
        if total_sec == 0:
            raise RuntimeError("Audio too short or could not be decoded.")

        rows = []
        for i in range(total_sec):
            start = i * sr
            end = start + sr
            frame = y[start:end]
            feats = extract_frame_features(frame, sr)
            feats["time_sec"] = i
            rows.append(feats)

        feat_df = pd.DataFrame(rows)
        axes_df = features_to_axes(feat_df)

        return axes_df, metadata


def get_average_profile(df: pd.DataFrame) -> dict:
    """Get average emotional profile across all time frames."""
    return {
        "valence": float(df["valence"].mean()),
        "energy": float(df["energy"].mean()),
        "tension": float(df["tension"].mean()),
        "warmth": float(df["warmth"].mean()),
        "power": float(df["power"].mean()),
        "complexity": float(df["complexity"].mean()),
    }


# =========================
# Aura Image Generation
# =========================

def generate_aura_image(metadata: dict, profile: dict, context: dict) -> str | None:
    """Generate an abstract aura image representing the song's emotional profile.
    Returns compressed base64 WebP image string or None if generation fails."""
    from PIL import Image
    import io
    
    def get_intensity(val):
        if val < 0.3: return "subtle, faint"
        if val < 0.6: return "moderate, balanced"
        return "intense, vivid"
    
    def get_color_palette(profile):
        colors = []
        if profile['valence'] < 0.4:
            colors.extend(["deep blue", "violet", "indigo"])
        elif profile['valence'] > 0.6:
            colors.extend(["golden yellow", "warm orange", "soft pink"])
        else:
            colors.extend(["teal", "soft green", "lavender"])
        
        if profile['energy'] > 0.7:
            colors.extend(["electric", "neon accents", "bright"])
        elif profile['energy'] < 0.3:
            colors.extend(["muted", "pastel", "soft glow"])
        
        if profile['warmth'] > 0.6:
            colors.extend(["amber", "coral", "warm red"])
        elif profile['warmth'] < 0.4:
            colors.extend(["icy cyan", "silver", "cool white"])
        
        if profile['tension'] > 0.6:
            colors.extend(["deep shadows", "dark purple accents"])
        
        return ", ".join(colors[:6])
    
    def get_texture(profile):
        textures = []
        if profile['complexity'] > 0.6:
            textures.append("intricate fractal patterns")
            textures.append("layered geometric shapes")
        else:
            textures.append("smooth flowing gradients")
            textures.append("simple organic curves")
        
        if profile['power'] > 0.6:
            textures.append("bold radiating waves")
            textures.append("explosive light bursts")
        else:
            textures.append("gentle misty wisps")
            textures.append("soft ethereal glow")
        
        return ", ".join(textures[:3])
    
    def compress_image(image_bytes: bytes, max_size: int = 512, quality: int = 82) -> bytes:
        """Compress image to WebP format with resize."""
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (WebP doesn't support all modes)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (0, 0, 0))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if larger than max_size
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Save as WebP
        output = io.BytesIO()
        img.save(output, format='WEBP', quality=quality, method=6)
        return output.getvalue()
    
    colors = get_color_palette(profile)
    texture = get_texture(profile)
    energy_desc = get_intensity(profile['energy'])
    
    vibe_tags = context.get('vibe_tags', ['atmospheric'])[:3]
    headline = context.get('headline', 'musical energy')
    
    prompt = f"""Create an abstract, artistic aura visualization representing a song's emotional energy.

STYLE: Abstract digital art, like a synesthetic visualization of sound. NO text, NO music notes, NO instruments, NO people, NO faces. Pure abstract energy and color.

EMOTIONAL PROFILE TO VISUALIZE:
- Overall vibe: {headline}
- Mood tags: {', '.join(vibe_tags)}
- Energy level: {energy_desc} ({profile['energy']:.0%})
- Emotional warmth: {profile['warmth']:.0%}
- Tension/suspense: {profile['tension']:.0%}
- Complexity: {profile['complexity']:.0%}

VISUAL DIRECTION:
- Color palette: {colors}
- Textures and shapes: {texture}
- The image should feel like looking at the "soul" or "aura" of the music
- Think: aurora borealis meets sound waves meets cosmic nebula
- Aspect ratio: square
- Style: dreamy, ethereal, flowing energy fields with depth

Create a mesmerizing, abstract visualization that captures this emotional signature."""

    try:
        print(f"Generating aura image for: {metadata['title']}")
        
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=['IMAGE', 'TEXT']
            )
        )
        
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                image_bytes = part.inline_data.data
                
                # Compress to WebP (512x512, quality 82)
                compressed = compress_image(image_bytes, max_size=512, quality=82)
                image_base64 = base64.b64encode(compressed).decode('utf-8')
                
                original_kb = len(image_bytes) / 1024
                compressed_kb = len(compressed) / 1024
                print(f"Aura image: {original_kb:.1f}KB → {compressed_kb:.1f}KB ({100*compressed_kb/original_kb:.0f}%)")
                
                return f"data:image/webp;base64,{image_base64}"
        
        print("No image in response")
        return None
        
    except Exception as e:
        print(f"Aura image generation error: {e}")
        import traceback
        traceback.print_exc()
        return None


# =========================
# Context Analysis (Text)
# =========================

def generate_context_analysis(metadata: dict, profile: dict, time_series: list) -> dict:
    """Use Gemini to generate comprehensive context and recommendations."""
    
    timeline_summary = []
    if len(time_series) >= 10:
        third = len(time_series) // 3
        for i, section in enumerate(["opening", "middle", "closing"]):
            start = i * third
            end = (i + 1) * third if i < 2 else len(time_series)
            section_data = time_series[start:end]
            avg = {k: sum(d[k] for d in section_data) / len(section_data) 
                   for k in ["valence", "energy", "tension", "warmth", "power", "complexity"]}
            timeline_summary.append({"section": section, **avg})
    
    prompt = f"""You are Nano Banana 🍌, a brilliant music psychologist. Analyze this song's emotional profile.

SONG: "{metadata['title']}" by {metadata['artist']}
Duration: {metadata.get('duration', 0)} seconds

EMOTIONAL PROFILE (0-1 scale):
- Valence (Sad↔Happy): {profile['valence']:.2f}
- Energy (Calm↔Intense): {profile['energy']:.2f}
- Tension (Relaxed↔Suspenseful): {profile['tension']:.2f}
- Warmth (Cold↔Affectionate): {profile['warmth']:.2f}
- Power (Intimate↔Epic): {profile['power']:.2f}
- Complexity (Simple↔Intricate): {profile['complexity']:.2f}

TIMELINE:
{json.dumps(timeline_summary, indent=2) if timeline_summary else "N/A"}

Return ONLY valid JSON in this format:
{{
  "emoji": "single emoji",
  "headline": "5-8 word summary",
  "vibe_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "deep_analysis": {{
    "emotional_narrative": "3-4 sentences",
    "sonic_character": "2-3 sentences",
    "standout_quality": "one sentence"
  }},
  "timeline_analysis": {{
    "opening": "description",
    "development": "description",
    "conclusion": "description",
    "overall_arc": "building crescendo|emotional descent|steady state|roller coaster|tension and release|slow burn|explosive opening"
  }},
  "listener_psychology": {{
    "personality_traits": ["trait1", "trait2", "trait3", "trait4"],
    "emotional_needs": "description",
    "psychology_insight": "2-3 sentences",
    "mbti_vibes": "e.g., INFP, ENFJ"
  }},
  "context_recommendations": {{
    "locations": [{{"place": "loc", "why": "reason", "vibe_match": "axis"}}],
    "activities": [{{"activity": "act", "why": "reason"}}],
    "seasons": {{"best": "season", "why": "reason", "time_of_day": "time", "weather": "weather"}},
    "social_context": "description"
  }},
  "demographics": {{
    "age_range": "range",
    "lifestyle": "description",
    "aesthetic": "description",
    "subculture": "description"
  }},
  "playlist_recommendations": {{
    "playlist_name": "name",
    "playlist_vibe": "description",
    "similar_energy_songs": ["song1 - artist", "song2 - artist"],
    "unexpected_pairing": "description"
  }},
  "fun_insights": {{
    "if_this_song_were": {{
      "color": "color",
      "texture": "texture",
      "movie_scene": "scene",
      "drink": "drink",
      "time_period": "era"
    }},
    "conversation_starter": "observation"
  }}
}}"""

    try:
        response = client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=[prompt]
        )
        text = response.text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        return json.loads(text)
    except Exception as e:
        print(f"Gemini error: {e}")
        return {
            "emoji": "🎵",
            "headline": "A unique sonic experience",
            "vibe_tags": ["musical", "expressive", "dynamic"],
            "deep_analysis": {"emotional_narrative": "Analysis pending.", "sonic_character": "Analysis pending.", "standout_quality": "Unique"},
            "timeline_analysis": {"opening": "N/A", "development": "N/A", "conclusion": "N/A", "overall_arc": "steady state"},
            "listener_psychology": {"personality_traits": ["curious"], "emotional_needs": "Varied", "psychology_insight": "Pending.", "mbti_vibes": "All"},
            "context_recommendations": {"locations": [{"place": "Anywhere", "why": "Versatile", "vibe_match": "energy"}], "activities": [{"activity": "Listening", "why": "Universal"}], "seasons": {"best": "Any", "why": "Timeless", "time_of_day": "Anytime", "weather": "Any"}, "social_context": "Flexible"},
            "demographics": {"age_range": "All", "lifestyle": "Varied", "aesthetic": "Eclectic", "subculture": "Mainstream"},
            "playlist_recommendations": {"playlist_name": "Favorites", "playlist_vibe": "Collection.", "similar_energy_songs": [], "unexpected_pairing": "TBD"},
            "fun_insights": {"if_this_song_were": {"color": "Blue", "texture": "Smooth", "movie_scene": "Montage", "drink": "Water", "time_period": "Now"}, "conversation_starter": "Interesting!"}
        }


# =========================
# API Routes
# =========================

@app.route("/api/analyze", methods=["POST"])
def analyze():
    """Analyze a YouTube URL."""
    data = request.json
    url = data.get("url")
    
    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        print(f"Analyzing: {url}")
        axes_df, metadata = analyze_audio(url)
        profile = get_average_profile(axes_df)
        time_series = axes_df.to_dict(orient="records")
        
        print("Generating context analysis...")
        context = generate_context_analysis(metadata, profile, time_series)
        
        print("Generating aura image...")
        aura_image = generate_aura_image(metadata, profile, context)

        return jsonify({
            "success": True,
            "metadata": metadata,
            "profile": profile,
            "timeSeries": time_series,
            "context": context,
            "auraImage": aura_image
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "nano-banana"})


if __name__ == "__main__":
    app.run(debug=True, port=5001)