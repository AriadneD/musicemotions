# youtube_integration.py
import os
import json
import tempfile
import base64
from pathlib import Path
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify, redirect
import requests
import numpy as np
import pandas as pd
from yt_dlp import YoutubeDL
import librosa

youtube_bp = Blueprint('youtube', __name__)

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

# Get from environment
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI", "http://localhost:5001/api/youtube/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Scopes for YouTube read access
SCOPES = "https://www.googleapis.com/auth/youtube.readonly"


def get_auth_header(token):
    return {"Authorization": f"Bearer {token}"}


# ============================================
# Audio Analysis Functions (copied from app.py)
# ============================================

def safe_entropy(p, eps=1e-9):
    p = np.asarray(p, dtype=float)
    p = p / (p.sum() + eps)
    return float(-(p * np.log2(p + eps)).sum())


def extract_frame_features(y_frame, sr):
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
    except:
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


def norm_series(s):
    s_min, s_max = float(s.min()), float(s.max())
    if s_max == s_min:
        return pd.Series(0.5, index=s.index)
    return (s - s_min) / (s_max - s_min)


def features_to_axes(df):
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


def analyze_youtube_video(video_id, snippet_seconds=45):
    """Analyze a YouTube video by ID. Returns profile + metadata."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    
    with tempfile.TemporaryDirectory() as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        tmpdir.mkdir(parents=True, exist_ok=True)
        out_tmpl = str(tmpdir / "%(id)s.%(ext)s")

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

        TARGET_SR = 22050
        y, sr = librosa.load(str(filename), sr=TARGET_SR, mono=True, duration=snippet_seconds)

        total_sec = min(snippet_seconds, int(np.floor(len(y) / sr)))
        if total_sec == 0:
            raise RuntimeError("Audio too short")

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

        profile = {
            "valence": float(axes_df["valence"].mean()),
            "energy": float(axes_df["energy"].mean()),
            "tension": float(axes_df["tension"].mean()),
            "warmth": float(axes_df["warmth"].mean()),
            "power": float(axes_df["power"].mean()),
            "complexity": float(axes_df["complexity"].mean()),
        }

        time_series = axes_df.to_dict(orient="records")

        return {
            "metadata": metadata,
            "profile": profile,
            "timeSeries": time_series,
            "url": url
        }


# ============================================
# OAuth Routes
# ============================================

@youtube_bp.route('/login')
def youtube_login():
    """Redirect to Google authorization."""
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPES,
        'access_type': 'offline',
        'prompt': 'consent'
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return jsonify({'auth_url': auth_url})


@youtube_bp.route('/callback')
def youtube_callback():
    """Handle Google OAuth callback."""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return redirect(f"{FRONTEND_URL}/youtube?error={error}")
    
    if not code:
        return redirect(f"{FRONTEND_URL}/youtube?error=no_code")
    
    # Exchange code for tokens
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': REDIRECT_URI
        }
    )
    
    if response.status_code != 200:
        print(f"Token exchange error: {response.text}")
        return redirect(f"{FRONTEND_URL}/youtube?error=token_failed")
    
    tokens = response.json()
    access_token = tokens.get('access_token')
    refresh_token = tokens.get('refresh_token', '')
    
    return redirect(f"{FRONTEND_URL}/youtube?yt_token={access_token}&yt_refresh={refresh_token}")


@youtube_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """Refresh YouTube access token."""
    data = request.json
    refresh_token = data.get('refresh_token')
    
    if not refresh_token:
        return jsonify({'error': 'No refresh token'}), 400
    
    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }
    )
    
    if response.status_code != 200:
        return jsonify({'error': 'Refresh failed'}), 401
    
    return jsonify(response.json())


# ============================================
# YouTube API Routes
# ============================================

@youtube_bp.route('/me')
def get_user():
    """Get current YouTube user (channel) info."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    response = requests.get(
        f"{YOUTUBE_API_BASE}/channels",
        params={'part': 'snippet', 'mine': 'true'},
        headers=get_auth_header(token)
    )
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to get user'}), response.status_code
    
    data = response.json()
    if data.get('items'):
        channel = data['items'][0]
        return jsonify({
            'id': channel['id'],
            'title': channel['snippet']['title'],
            'thumbnail': channel['snippet']['thumbnails']['default']['url']
        })
    
    return jsonify({'error': 'No channel found'}), 404


@youtube_bp.route('/playlists')
def get_playlists():
    """Get user's YouTube playlists."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    playlists = []
    page_token = None
    
    while True:
        params = {
            'part': 'snippet,contentDetails',
            'mine': 'true',
            'maxResults': 50
        }
        if page_token:
            params['pageToken'] = page_token
        
        response = requests.get(
            f"{YOUTUBE_API_BASE}/playlists",
            params=params,
            headers=get_auth_header(token)
        )
        
        if response.status_code != 200:
            print(f"Playlists error: {response.text}")
            return jsonify({'error': 'Failed to get playlists'}), response.status_code
        
        data = response.json()
        
        for item in data.get('items', []):
            playlists.append({
                'id': item['id'],
                'name': item['snippet']['title'],
                'description': item['snippet'].get('description', ''),
                'image': item['snippet']['thumbnails'].get('medium', {}).get('url') or 
                         item['snippet']['thumbnails'].get('default', {}).get('url'),
                'tracks_count': item['contentDetails']['itemCount']
            })
        
        page_token = data.get('nextPageToken')
        if not page_token:
            break
    
    # Also add Liked Videos playlist
    playlists.insert(0, {
        'id': 'LL',
        'name': '❤️ Liked Videos',
        'description': 'Your liked videos',
        'image': None,
        'tracks_count': None  # Unknown count
    })
    
    return jsonify({'playlists': playlists})


@youtube_bp.route('/playlist/<playlist_id>/videos')
def get_playlist_videos(playlist_id):
    """Get all videos from a playlist."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    videos = []
    page_token = None
    
    while True:
        params = {
            'part': 'snippet,contentDetails',
            'playlistId': playlist_id,
            'maxResults': 50
        }
        if page_token:
            params['pageToken'] = page_token
        
        response = requests.get(
            f"{YOUTUBE_API_BASE}/playlistItems",
            params=params,
            headers=get_auth_header(token)
        )
        
        if response.status_code != 200:
            print(f"Playlist items error: {response.text}")
            return jsonify({'error': 'Failed to get videos'}), response.status_code
        
        data = response.json()
        
        for item in data.get('items', []):
            snippet = item['snippet']
            video_id = snippet.get('resourceId', {}).get('videoId')
            
            if video_id:  # Skip deleted videos
                videos.append({
                    'id': video_id,
                    'title': snippet['title'],
                    'channel': snippet.get('videoOwnerChannelTitle', 'Unknown'),
                    'thumbnail': snippet['thumbnails'].get('medium', {}).get('url') or
                                 snippet['thumbnails'].get('default', {}).get('url'),
                    'position': snippet['position']
                })
        
        page_token = data.get('nextPageToken')
        if not page_token:
            break
    
    return jsonify({'videos': videos, 'total': len(videos)})


@youtube_bp.route('/analyze-video/<video_id>', methods=['POST'])
def analyze_single_video(video_id):
    """Analyze a single YouTube video. This is the heavy operation."""
    try:
        print(f"[youtube] Analyzing video: {video_id}")
        result = analyze_youtube_video(video_id)
        print(f"[youtube] Completed: {result['metadata']['title']}")
        return jsonify({
            'success': True,
            **result
        })
    except Exception as e:
        print(f"[youtube] Error analyzing {video_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'video_id': video_id
        }), 500