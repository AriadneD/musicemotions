# spotify_integration.py
# Add this to your backend folder and import in app.py

import os
import base64
import requests
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify, redirect, session

spotify_bp = Blueprint('spotify', __name__)

# Spotify API endpoints
SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

# Get these from environment variables
CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:5001/api/spotify/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Scopes needed for playlist access
SCOPES = "playlist-read-private playlist-read-collaborative user-library-read"


def get_auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def map_spotify_to_axes(features):
    """Map Spotify audio features to our 6 emotional axes."""
    if not features:
        return None
    
    # Spotify provides: acousticness, danceability, energy, instrumentalness,
    # liveness, loudness, speechiness, tempo, valence, mode, key
    
    # Our axes mapping:
    # 1. Valence (Sad↔Happy) - Spotify has this directly!
    valence = features.get('valence', 0.5)
    
    # 2. Energy (Calm↔Intense) - Spotify has this directly!
    energy = features.get('energy', 0.5)
    
    # 3. Tension (Relaxed↔Suspenseful) - derive from mode, energy, tempo
    # Minor mode + high energy + fast tempo = more tension
    mode = features.get('mode', 1)  # 1 = major, 0 = minor
    tempo_norm = min(features.get('tempo', 120) / 200, 1.0)  # Normalize tempo
    tension = (1 - mode) * 0.3 + energy * 0.4 + tempo_norm * 0.3
    
    # 4. Warmth (Cold↔Affectionate) - derive from acousticness, valence, low danceability
    acousticness = features.get('acousticness', 0.5)
    danceability = features.get('danceability', 0.5)
    warmth = acousticness * 0.4 + valence * 0.4 + (1 - energy) * 0.2
    
    # 5. Power (Intimate↔Epic) - derive from loudness, energy, tempo
    # Loudness is in dB, typically -60 to 0
    loudness = features.get('loudness', -10)
    loudness_norm = (loudness + 60) / 60  # Normalize to 0-1
    power = loudness_norm * 0.4 + energy * 0.4 + tempo_norm * 0.2
    
    # 6. Complexity (Simple↔Intricate) - derive from instrumentalness, tempo variance, speechiness inverse
    instrumentalness = features.get('instrumentalness', 0.5)
    speechiness = features.get('speechiness', 0.1)
    complexity = instrumentalness * 0.3 + (1 - speechiness) * 0.3 + danceability * 0.2 + tempo_norm * 0.2
    
    return {
        'valence': max(0, min(1, valence)),
        'energy': max(0, min(1, energy)),
        'tension': max(0, min(1, tension)),
        'warmth': max(0, min(1, warmth)),
        'power': max(0, min(1, power)),
        'complexity': max(0, min(1, complexity)),
    }


@spotify_bp.route('/login')
def spotify_login():
    """Redirect to Spotify authorization."""
    params = {
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': REDIRECT_URI,
        'scope': SCOPES,
        'show_dialog': 'true'
    }
    auth_url = f"{SPOTIFY_AUTH_URL}?{urlencode(params)}"
    return jsonify({'auth_url': auth_url})


@spotify_bp.route('/callback')
def spotify_callback():
    """Handle Spotify OAuth callback."""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        return redirect(f"{FRONTEND_URL}?spotify_error={error}")
    
    if not code:
        return redirect(f"{FRONTEND_URL}?spotify_error=no_code")
    
    # Exchange code for tokens
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    
    response = requests.post(
        SPOTIFY_TOKEN_URL,
        headers={
            'Authorization': f'Basic {auth_header}',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI
        }
    )
    
    if response.status_code != 200:
        return redirect(f"{FRONTEND_URL}?spotify_error=token_failed")
    
    tokens = response.json()
    access_token = tokens.get('access_token')
    refresh_token = tokens.get('refresh_token')
    
    # Redirect back to frontend with tokens (in production, use secure cookies or session)
    return redirect(f"{FRONTEND_URL}?spotify_token={access_token}&spotify_refresh={refresh_token}")


@spotify_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """Refresh Spotify access token."""
    data = request.json
    refresh_token = data.get('refresh_token')
    
    if not refresh_token:
        return jsonify({'error': 'No refresh token'}), 400
    
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    
    response = requests.post(
        SPOTIFY_TOKEN_URL,
        headers={
            'Authorization': f'Basic {auth_header}',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
    )
    
    if response.status_code != 200:
        return jsonify({'error': 'Refresh failed'}), 401
    
    return jsonify(response.json())


@spotify_bp.route('/me')
def get_user():
    """Get current Spotify user profile."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    response = requests.get(
        f"{SPOTIFY_API_BASE}/me",
        headers=get_auth_header(token)
    )
    
    if response.status_code != 200:
        return jsonify({'error': 'Failed to get user'}), response.status_code
    
    return jsonify(response.json())


@spotify_bp.route('/playlists')
def get_playlists():
    """Get user's playlists."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    playlists = []
    url = f"{SPOTIFY_API_BASE}/me/playlists?limit=50"
    
    while url:
        response = requests.get(url, headers=get_auth_header(token))
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to get playlists'}), response.status_code
        
        data = response.json()
        playlists.extend([{
            'id': p['id'],
            'name': p['name'],
            'image': p['images'][0]['url'] if p['images'] else None,
            'tracks_count': p['tracks']['total'],
            'owner': p['owner']['display_name']
        } for p in data['items']])
        
        url = data.get('next')  # Pagination
    
    return jsonify({'playlists': playlists})


@spotify_bp.route('/playlist/<playlist_id>/tracks')
def get_playlist_tracks(playlist_id):
    """Get all tracks from a playlist."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    tracks = []
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks?limit=100"
    
    while url:
        response = requests.get(url, headers=get_auth_header(token))
        
        if response.status_code != 200:
            return jsonify({'error': 'Failed to get tracks'}), response.status_code
        
        data = response.json()
        
        for item in data['items']:
            track = item.get('track')
            if track and track.get('id'):  # Skip local files
                tracks.append({
                    'id': track['id'],
                    'name': track['name'],
                    'artist': ', '.join(a['name'] for a in track['artists']),
                    'album': track['album']['name'],
                    'image': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'duration_ms': track['duration_ms'],
                    'preview_url': track.get('preview_url')
                })
        
        url = data.get('next')
    
    return jsonify({'tracks': tracks})


@spotify_bp.route('/audio-features', methods=['POST'])
def get_audio_features():
    """Get audio features for multiple tracks (batch)."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    data = request.json
    track_ids = data.get('track_ids', [])
    
    print(f"[audio-features] Received request for {len(track_ids)} tracks")
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    if not track_ids:
        return jsonify({'error': 'No track IDs'}), 400
    
    all_features = {}
    api_available = True
    
    # Spotify allows max 100 IDs per request
    for i in range(0, len(track_ids), 100):
        batch = track_ids[i:i+100]
        ids_str = ','.join(batch)
        
        response = requests.get(
            f"{SPOTIFY_API_BASE}/audio-features?ids={ids_str}",
            headers=get_auth_header(token)
        )
        
        print(f"[audio-features] Spotify API response: {response.status_code}")
        
        if response.status_code == 403:
            print("[audio-features] 403 Forbidden - Audio features API restricted for this app")
            api_available = False
            break
        
        if response.status_code != 200:
            print(f"[audio-features] Error: {response.text}")
            continue
        
        features_data = response.json().get('audio_features', [])
        
        for f in features_data:
            if f:
                all_features[f['id']] = {
                    'spotify_features': f,
                    'axes': map_spotify_to_axes(f)
                }
    
    # If API is restricted, return a flag so frontend knows
    if not api_available:
        return jsonify({
            'features': {},
            'api_restricted': True,
            'message': 'Spotify Audio Features API requires Extended Quota Mode. Apply at developer.spotify.com'
        })
    
    print(f"[audio-features] Returning {len(all_features)} processed features")
    return jsonify({'features': all_features, 'api_restricted': False})


@spotify_bp.route('/analyze-playlist', methods=['POST'])
def analyze_playlist():
    """Analyze entire playlist efficiently - returns all tracks with emotional profiles."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    data = request.json
    playlist_id = data.get('playlist_id')
    
    if not token:
        return jsonify({'error': 'No token'}), 401
    
    if not playlist_id:
        return jsonify({'error': 'No playlist ID'}), 400
    
    # Step 1: Get all tracks
    tracks = []
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks?limit=100"
    
    while url:
        response = requests.get(url, headers=get_auth_header(token))
        if response.status_code != 200:
            return jsonify({'error': 'Failed to get tracks'}), response.status_code
        
        data = response.json()
        for item in data['items']:
            track = item.get('track')
            if track and track.get('id'):
                tracks.append({
                    'id': track['id'],
                    'name': track['name'],
                    'artist': ', '.join(a['name'] for a in track['artists']),
                    'album': track['album']['name'],
                    'image': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'duration_ms': track['duration_ms']
                })
        url = data.get('next')
    
    # Step 2: Get audio features in batches
    track_ids = [t['id'] for t in tracks]
    features_map = {}
    
    for i in range(0, len(track_ids), 100):
        batch = track_ids[i:i+100]
        ids_str = ','.join(batch)
        
        response = requests.get(
            f"{SPOTIFY_API_BASE}/audio-features?ids={ids_str}",
            headers=get_auth_header(token)
        )
        
        if response.status_code == 200:
            features_data = response.json().get('audio_features', [])
            for f in features_data:
                if f:
                    features_map[f['id']] = f
    
    # Step 3: Combine tracks with their emotional profiles
    analyzed_tracks = []
    for track in tracks:
        features = features_map.get(track['id'])
        axes = map_spotify_to_axes(features) if features else None
        
        analyzed_tracks.append({
            **track,
            'profile': axes,
            'spotify_features': features
        })
    
    # Step 4: Calculate playlist-level stats
    profiles = [t['profile'] for t in analyzed_tracks if t['profile']]
    
    if profiles:
        avg_profile = {
            key: sum(p[key] for p in profiles) / len(profiles)
            for key in ['valence', 'energy', 'tension', 'warmth', 'power', 'complexity']
        }
    else:
        avg_profile = None
    
    return jsonify({
        'tracks': analyzed_tracks,
        'total': len(analyzed_tracks),
        'average_profile': avg_profile
    })