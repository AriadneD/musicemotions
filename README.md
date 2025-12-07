# Muse - the emotional DNA of your music

> **Hackathon Project**: Multi-Modality Challenge  
> Leveraging **Gemini 3 Pro Preview** + **Nano Banana Pro** for rich multi-modal music analysis

Analyze the emotional DNA of any song on YouTube. Get a 6-dimensional emotional profile and AI-powered context recommendations for when and where to listen.

---

## 🎯 Hackathon Submission

### Problem Statement: Multi-Modality

**How Muse addresses it**: Muse combines audio analysis, visual representation, and generative AI to create a truly multi-modal music experience. Nano Banana Pro's enhanced image generation capabilities power our album art visualization, while Gemini 3 Pro Preview generates contextual insights by understanding both the audio features and visual emotional data together.

### Technologies Used

- **Gemini 3 Pro Preview**: Powers the AI-driven context generation, analyzing emotional profiles to provide personalized recommendations
- **Nano Banana Pro**: Generates high-fidelity 2K visualizations of emotional timelines and creates custom artwork reflecting the song's emotional DNA
- **Additional Stack**: librosa (audio analysis), yt-dlp (YouTube integration), React + Recharts (interactive UI)

---

## 📋 Judging Criteria Responses

### 1. Impact — Long-term Potential

Muse doesn’t just fix music discovery—it fills a gap in how we understand ourselves through what we listen to. Streaming platforms organize songs by genre and vibe, but they miss the emotional context of listening: the way we use music for self-discovery, relationship building, emotional processing, conflict resolution, and getting into deep-focus flow.

Muse’s emotional profiling can power:

Smart playlist curation – “Find me songs for a rainy afternoon drive with my best friend” or “give me calm-but-confident pre-presentation hype music.”

Music therapy & emotional processing – Curate tracks that support specific goals like grounding anxiety, processing grief, or boosting motivation.

Relationship & social experiences – Generate shared emotional playlists (“our songs”) that reflect how two people feel, not just what they like on paper.

Conflict resolution & communication – Let people “say how they feel” through emotionally tagged tracks, creating shared understanding when words are hard.

Productivity & habit-building – Build emotion-aware focus, study, or workout playlists that adapt as your energy and mood shift.

Personal music journaling – Track how your emotional music patterns evolve over time and surface insights about your inner life, not just your listening history.

Muse exemplifies multi-modality by synthesizing:
- Audio feature extraction (spectral, harmonic, rhythmic analysis)
- Visual emotional mapping (radar charts, timeline graphs via Nano Banana Pro)
- Natural language context generation (Gemini 3 understanding emotional + audio data)

**Is it useful, and for who?**

- **Music lovers**: Discover why certain songs resonate emotionally
- **DJs/Curators**: Build emotionally coherent sets scientifically
- **Therapists**: Evidence-based music recommendations for mood regulation
- **Developers**: API for emotional music search in apps

### 2. Demo — Implementation Quality

Muse is a **fully functional** end-to-end application:

✅ **Working Features**:
- Real-time YouTube audio extraction and analysis
- 6-axis emotional profiling with librosa-powered acoustic feature extraction
- Interactive radar chart visualization with smooth animations
- Timeline view showing emotional evolution across the song
- Gemini 3 Pro context generation producing tailored recommendations
- Nano Banana Pro rendering emotional snapshots at 2K resolution

✅ **Robust Architecture**:
- Python Flask backend with comprehensive error handling
- React frontend with responsive design
- RESTful API design for scalability
- Environment-based configuration for security

✅ **Demo-Ready**:
- Live at `localhost:3000` with sub-5 second analysis time
- Handles edge cases (unavailable videos, network errors)
- Polished UI with Framer Motion animations

### 3. Creativity — Innovation

**Novel approach**: While music analysis tools exist, Muse uniquely:

1. **6-Dimensional Emotional Framework**: Goes beyond simple "happy/sad" to capture nuanced emotions (tension, warmth, power, complexity)

2. **Temporal Emotional Mapping**: Most tools give static analysis; Muse shows how emotions *evolve* throughout a track

3. **Context-Aware AI**: Gemini doesn't just analyze — it understands *when* and *where* a song fits into your life

4. **Multi-Modal Synthesis**: Nano Banana Pro creates visual "emotional fingerprints" that make abstract audio features tangible and shareable

**Unique demo elements**:
- Emoji-based emotional summaries (🎸 vs 🌙 vs 💪)
- "Mood Match" system suggesting emotional states
- AI-generated location/activity pairings (beach sunset, morning jog, late-night coding)

### 4. Pitch — Presentation

Muse tells a clear story:

**The Hook**: "Ever wondered why a song *feels* perfect for a moment?"

**The Problem**: Music discovery is based on genres and popularity, not emotional fit

**The Solution**: Muse analyzes the emotional DNA of music and tells you exactly when and where to listen

**The Demo**: https://www.loom.com/share/66b0a0a854a348f2b4ae7c85c2754942
1. Paste any YouTube link → 
2. See your song's emotional fingerprint → 
3. Get AI-powered context for the perfect listening moment

**The Tech**: Multi-modal AI (Gemini 3 + Nano Banana Pro) makes this possible by understanding audio, visuals, and context together

**The Future**: API for developers, Spotify integration, personal emotional music maps

---

## Features

- **6-Axis Emotional Profiling**: Valence, Energy, Tension, Warmth, Power, Complexity
- **Interactive Radar Chart**: Visualize the emotional fingerprint of any track
- **Timeline View**: See how emotions evolve throughout the song powered by Nano Banana Pro
- **AI Context Generation**: Gemini 3 Pro-powered recommendations for locations, activities, and moods
- **2K Visualizations**: Nano Banana Pro renders high-fidelity emotional graphics

## Architecture

```
nanobanana/
├── backend/           # Python Flask API
│   ├── app.py         # Main Flask application + Gemini 3 integration
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

# Set up Gemini API key in .env
echo "GEMINI_API_KEY=your_key_here" > .env

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

- **AI/ML**: Google Gemini 3 Pro Preview, Nano Banana Pro
- **Backend**: Python, Flask, librosa, yt-dlp
- **Frontend**: React, Recharts, Framer Motion
- **Analysis**: Spectral features (MFCC, chroma, onset strength, spectral centroid, zero-crossing rate)

## Multi-Modal Integration

Muse showcases the power of combining modalities:

1. **Audio → Features**: librosa extracts acoustic signatures
2. **Features → Emotions**: Custom algorithms map to 6 emotional axes
3. **Emotions → Visuals**: Nano Banana Pro generates 2K emotional timelines
4. **Emotions → Context**: Gemini 3 Pro understands emotional profiles to suggest real-world contexts
5. **All → User**: Integrated React UI presents the complete multi-modal experience

## License

MIT