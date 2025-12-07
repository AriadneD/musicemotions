import sys
import json
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from yt_dlp import YoutubeDL
import librosa


# =========================
# 1. Download YouTube audio
# =========================

def download_audio_from_youtube(url: str, out_dir: Path) -> Path:
    """
    Download best audio from YouTube.
    librosa can load most audio containers directly (e.g., webm, m4a).
    """
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

    return Path(filename)


# =========================
# 2. Core feature extractors
# =========================

def safe_entropy(p: np.ndarray, eps: float = 1e-9) -> float:
    """Shannon entropy of a probability vector p (base 2)."""
    p = np.asarray(p, dtype=float)
    p = p / (p.sum() + eps)
    return float(-(p * np.log2(p + eps)).sum())


def extract_frame_features(y_frame: np.ndarray, sr: int) -> dict:
    """
    Extract per-1-second frame features used later to build emotion axes.
    """
    # Safety: avoid crashes on silence
    if len(y_frame) == 0:
        return {
            "rms": 0.0,
            "centroid": 0.0,
            "bandwidth": 0.0,
            "zcr": 0.0,
            "onset_strength": 0.0,
            "spectral_flatness": 0.0,
            "percussive_ratio": 0.0,
            "tonal_tension": 0.0,
            "low_mid_energy_ratio": 0.0,
            "chroma_entropy": 0.0,
        }

    # Basic spectral features
    S = np.abs(librosa.stft(y_frame, n_fft=2048, hop_length=512))
    rms = librosa.feature.rms(S=S).mean()
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr).mean()
    bandwidth = librosa.feature.spectral_bandwidth(S=S, sr=sr).mean()
    zcr = librosa.feature.zero_crossing_rate(y_frame).mean()
    flatness = librosa.feature.spectral_flatness(S=S).mean()

    # Onset strength (rhythmic / percussive drive)
    onset_strength = librosa.onset.onset_strength(y=y_frame, sr=sr).mean()

    # Harmonic / percussive decomposition
    y_h, y_p = librosa.effects.hpss(y_frame)
    mean_h = np.mean(np.abs(y_h))
    mean_p = np.mean(np.abs(y_p))
    percussive_ratio = float(mean_p / (mean_h + mean_p + 1e-9))

    # Tonal tension via tonnetz norm (music-theory grounded tonal space)
    # Large norm -> more "distant"/unstable tonality
    try:
        tonnetz = librosa.feature.tonnetz(y=y_h, sr=sr)
        tonal_tension = float(np.linalg.norm(tonnetz, axis=0).mean())
    except Exception:
        tonal_tension = 0.0

    # Low/mid frequency energy ratio (warmth / fullness)
    mel = librosa.feature.melspectrogram(y=y_frame, sr=sr, n_mels=40, fmax=8000)
    mel_energy = mel.sum(axis=1)  # per-mel-band energy
    total_energy = float(mel_energy.sum() + 1e-9)
    # Treat the first ~10 mel bands as low-mid
    low_mid_energy = float(mel_energy[:10].sum())
    low_mid_energy_ratio = low_mid_energy / total_energy

    # Harmonic pitch-class distribution (for complexity)
    chroma = librosa.feature.chroma_stft(y=y_h, sr=sr)
    chroma_mean = chroma.mean(axis=1)  # 12-d pitch-class energy
    chroma_entropy = safe_entropy(chroma_mean)

    return {
        "rms": float(rms),
        "centroid": float(centroid),
        "bandwidth": float(bandwidth),
        "zcr": float(zcr),
        "onset_strength": float(onset_strength),
        "spectral_flatness": float(flatness),
        "percussive_ratio": float(percussive_ratio),
        "tonal_tension": float(tonal_tension),
        "low_mid_energy_ratio": float(low_mid_energy_ratio),
        "chroma_entropy": float(chroma_entropy),
    }


# =========================
# 3. Map features -> 6 axes
# =========================

def norm_series(s: pd.Series) -> pd.Series:
    """Min-max normalize a series to [0, 1] (per-song)."""
    s_min = float(s.min())
    s_max = float(s.max())
    if s_max == s_min:
        return pd.Series(0.5, index=s.index)
    return (s - s_min) / (s_max - s_min)


def features_to_axes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Given per-second feature dataframe, compute the 6 emotional axes.
    All outputs are in [0, 1] per song.
    """
    # Normalize core features per track
    for col in [
        "rms",
        "centroid",
        "bandwidth",
        "zcr",
        "onset_strength",
        "spectral_flatness",
        "percussive_ratio",
        "tonal_tension",
        "low_mid_energy_ratio",
        "chroma_entropy",
    ]:
        df[f"{col}_norm"] = norm_series(df[col])

    # ---- Energy / Arousal ----
    # Driven by loudness and rhythmic punch
    energy = (
        0.6 * df["rms_norm"] +
        0.3 * df["onset_strength_norm"] +
        0.1 * df["zcr_norm"]
    )

    # ---- Valence ----
    # High brightness + tension tends to feel harsher/negative.
    # Warmer (low-mid rich), less tense, slightly softer -> more positive.
    valence = (
        0.4 * (1.0 - df["centroid_norm"]) +          # darker/warmer -> happier
        0.2 * (1.0 - df["tonal_tension_norm"]) +     # stable tonality -> pleasant
        0.3 * df["low_mid_energy_ratio_norm"] +      # body / warmth
        0.1 * (1.0 - df["spectral_flatness_norm"])   # more harmonic -> nicer
    )

    # ---- Tension ----
    # Tonal distance, noisiness, and sharp attacks
    tension = (
        0.5 * df["tonal_tension_norm"] +
        0.3 * df["spectral_flatness_norm"] +    # noisy/inharmonic -> tense
        0.2 * df["onset_strength_norm"]         # sharp hits -> agitation
    )

    # ---- Warmth / Tenderness ----
    # Low-mid richness, lower brightness, less percussive
    warmth = (
        0.5 * df["low_mid_energy_ratio_norm"] +
        0.3 * (1.0 - df["centroid_norm"]) +
        0.2 * (1.0 - df["percussive_ratio_norm"])
    )

    # ---- Power / Grandeur ----
    # Loud, low-end rich, percussive
    power = (
        0.6 * df["rms_norm"] +
        0.2 * df["percussive_ratio_norm"] +
        0.2 * df["low_mid_energy_ratio_norm"]
    )

    # ---- Complexity / Intricacy ----
    # Dense pitch-class distribution, noisy spectrum, lots of crossings
    complexity = (
        0.5 * df["chroma_entropy_norm"] +       # harmonically 'spread out'
        0.3 * df["spectral_flatness_norm"] +    # noisy/texture complexity
        0.2 * df["zcr_norm"]                    # fine-grained motion
    )

    out = pd.DataFrame({
        "time_sec": df["time_sec"],
        "valence": valence.clip(0.0, 1.0),
        "energy": energy.clip(0.0, 1.0),
        "tension": tension.clip(0.0, 1.0),
        "warmth": warmth.clip(0.0, 1.0),
        "power": power.clip(0.0, 1.0),
        "complexity": complexity.clip(0.0, 1.0),
    })

    return out


# =========================
# 4. Main pipeline
# =========================

def analyze_youtube_track(url: str, out_csv: Path, snippet_seconds: int = 45):
    """
    1. Download YouTube audio
    2. Take a 45s snippet from the start
    3. Slice into 1s frames
    4. Compute features and emotional axes
    5. Save CSV
    """
    with tempfile.TemporaryDirectory() as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        print(f"[INFO] Downloading audio from {url} ...")
        audio_path = download_audio_from_youtube(url, tmpdir)
        print(f"[INFO] Downloaded to: {audio_path}")

        # Load audio; we only need snippet_seconds from start
        TARGET_SR = 22050
        print(f"[INFO] Loading first {snippet_seconds} seconds of audio ...")
        y, sr = librosa.load(str(audio_path), sr=TARGET_SR, mono=True, duration=snippet_seconds)

        total_sec = min(snippet_seconds, int(np.floor(len(y) / sr)))
        if total_sec == 0:
            raise RuntimeError("Audio too short or could not be decoded.")

        print(f"[INFO] Using {total_sec} seconds of audio at sr={sr}.")

        frame_len = sr       # 1-second frames
        hop_len = sr

        rows = []
        for i in range(total_sec):
            start = i * hop_len
            end = start + frame_len
            frame = y[start:end]
            feats = extract_frame_features(frame, sr)
            feats["time_sec"] = i
            rows.append(feats)

        feat_df = pd.DataFrame(rows)
        axes_df = features_to_axes(feat_df)
        axes_df.to_csv(out_csv, index=False)

        print(f"[INFO] Saved annotations to {out_csv}")
        print(axes_df.head())  # show a preview


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python youtube_emotion_profile.py <youtube_url> [output_csv]")
        sys.exit(1)

    youtube_url = sys.argv[1]
    if len(sys.argv) >= 3:
        output_csv = Path(sys.argv[2])
    else:
        output_csv = Path("emotion_annotations.csv")

    analyze_youtube_track(youtube_url, output_csv)
