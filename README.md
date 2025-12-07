# 🍌 Nano Banana - Musical Emotional Profiler

Analyze the emotional DNA of any song on YouTube. Get a 6-dimensional emotional profile and AI-powered context recommendations for when and where to listen.

## Features

- **6-Axis Emotional Profiling**: Valence, Energy, Tension, Warmth, Power, Complexity
- **Interactive Radar Chart**: Visualize the emotional fingerprint of any track
- **Timeline View**: See how emotions evolve throughout the song
- **AI Context Generation**: Gemini-powered recommendations for locations, activities, and moods

## Architecture

```
nanobanana/
├── backend/           # Python Flask API
│   ├── app.py         # Main Flask application
│   ├── .env           # Environment variables (Gemini API key)
│   └── requirements.txt
└── frontend/          # React application
    ├── src/
    │   ├── App.js     # Main React component
    │   ├── App.css    # Styling
    │   └── index.js   # Entry point
    └── public/
        └── index.html
```

## Setup & Running

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### POST /api/analyze

Analyze a YouTube URL for emotional profile.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "success": true,
  "metadata": {
    "title": "Song Title",
    "artist": "Artist Name",
    "thumbnail": "https://...",
    "duration": 180
  },
  "profile": {
    "valence": 0.65,
    "energy": 0.72,
    "tension": 0.45,
    "warmth": 0.58,
    "power": 0.61,
    "complexity": 0.49
  },
  "timeSeries": [...],
  "context": {
    "emoji": "🎸",
    "headline": "Upbeat and energetic mood-lifter",
    "analysis": "...",
    "locations": [...],
    "activities": [...],
    "time_of_day": "Morning",
    "mood_match": "Feeling motivated"
  }
}
```

## The 6 Emotional Axes

| Axis | Range | Description |
|------|-------|-------------|
| **Valence** | Sad ↔ Happy | Overall emotional pleasantness |
| **Energy** | Calm ↔ Intense | Drive, speed, percussive impact |
| **Tension** | Relaxed ↔ Suspenseful | Harmonic instability, dissonance |
| **Warmth** | Cold ↔ Affectionate | Gentle timbres, soothing feel |
| **Power** | Intimate ↔ Epic | Sense of scale, anthemic quality |
| **Complexity** | Simple ↔ Intricate | Rhythmic & harmonic richness |

## Tech Stack

- **Backend**: Python, Flask, librosa, yt-dlp, Google Gemini
- **Frontend**: React, Recharts, Framer Motion
- **Analysis**: Spectral features (MFCC, chroma, onset strength, etc.)

## License

MIT