// src/pages/SongDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { getSongById, getUserById } from '../firebase/songs';
import './SongDetail.css';

const AXES = [
  { key: 'valence', label: 'Valence', color: '#FFD93D' },
  { key: 'energy', label: 'Energy', color: '#FF6B6B' },
  { key: 'tension', label: 'Tension', color: '#C44569' },
  { key: 'warmth', label: 'Warmth', color: '#F8B500' },
  { key: 'power', label: 'Power', color: '#6C5CE7' },
  { key: 'complexity', label: 'Complexity', color: '#00D2D3' }
];

function SongDetail() {
  const { songId } = useParams();
  const [song, setSong] = useState(null);
  const [songUser, setSongUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSong();
  }, [songId]);

  const loadSong = async () => {
    try {
      const songData = await getSongById(songId);
      if (!songData) {
        setError('Song not found');
        return;
      }
      setSong(songData);

      // Load the user who analyzed this song
      if (songData.userId) {
        const userData = await getUserById(songData.userId);
        setSongUser(userData);
      }
    } catch (err) {
      console.error('Error loading song:', err);
      setError('Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="song-detail-page">
        <div className="song-detail-loading">
          <div className="loading-spinner large" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="song-detail-page">
        <div className="song-detail-error">
          <span className="error-emoji">😕</span>
          <h2>{error || 'Song not found'}</h2>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const { metadata, profile, context } = song;

  const radarData = profile
    ? AXES.map(axis => ({
        axis: axis.label,
        value: profile[axis.key] * 100,
        fullMark: 100
      }))
    : [];

  return (
    <div className="song-detail-page">
      <motion.div 
        className="song-detail-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <div className="song-detail-header">
          {metadata?.thumbnail && (
            <div className="detail-thumbnail-wrapper">
              <img src={metadata.thumbnail} alt={metadata.title} className="detail-thumbnail" />
              <div className="detail-thumbnail-glow" />
            </div>
          )}
          <div className="detail-info">
            <span className="detail-emoji">{context?.emoji || '🎵'}</span>
            <h1>{metadata?.title}</h1>
            <p className="detail-artist">{metadata?.artist}</p>
            <p className="detail-headline">{context?.headline}</p>
            {context?.vibe_tags && (
              <div className="detail-tags">
                {context.vibe_tags.map((tag, i) => (
                  <span key={i} className="detail-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Analyzed by */}
        {songUser && (
          <div className="analyzed-by">
            <span>Analyzed by</span>
            <Link to={`/profile/${songUser.username || songUser.id}`} className="user-link">
              <img src={songUser.photoURL} alt={songUser.displayName} className="user-thumb" />
              <span>{songUser.displayName}</span>
            </Link>
          </div>
        )}

        {/* Radar Chart */}
        <div className="detail-chart">
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: '#fff', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} />
              <Radar dataKey="value" stroke="#FFD93D" fill="#FFD93D" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>

          <div className="detail-axis-grid">
            {AXES.map((axis) => (
              <div key={axis.key} className="detail-axis-item">
                <div className="detail-axis-header">
                  <span className="detail-axis-dot" style={{ backgroundColor: axis.color }} />
                  <span>{axis.label}</span>
                </div>
                <div className="detail-axis-bar">
                  <div 
                    className="detail-axis-fill" 
                    style={{ 
                      backgroundColor: axis.color, 
                      width: `${profile[axis.key] * 100}%` 
                    }} 
                  />
                </div>
                <span className="detail-axis-value">{(profile[axis.key] * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis */}
        {context?.deep_analysis && (
          <div className="detail-section">
            <h2>Deep Analysis</h2>
            <div className="detail-analysis-grid">
              <div className="detail-analysis-card">
                <h4>🎭 Emotional Narrative</h4>
                <p>{context.deep_analysis.emotional_narrative}</p>
              </div>
              <div className="detail-analysis-card">
                <h4>🔊 Sonic Character</h4>
                <p>{context.deep_analysis.sonic_character}</p>
              </div>
              <div className="detail-analysis-card highlight">
                <h4>⭐ Standout Quality</h4>
                <p>{context.deep_analysis.standout_quality}</p>
              </div>
            </div>
          </div>
        )}

        {/* Locations */}
        {context?.context_recommendations?.locations && (
          <div className="detail-section">
            <h2>📍 Best Places to Listen</h2>
            <div className="detail-locations-grid">
              {context.context_recommendations.locations.map((loc, i) => (
                <div key={i} className="detail-location-card">
                  <h4>{loc.place}</h4>
                  <p>{loc.why}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Psychology */}
        {context?.listener_psychology && (
          <div className="detail-section">
            <h2>🧠 What This Says About You</h2>
            <p className="detail-insight">{context.listener_psychology.psychology_insight}</p>
            {context.listener_psychology.personality_traits && (
              <div className="detail-traits">
                {context.listener_psychology.personality_traits.map((trait, i) => (
                  <span key={i} className="detail-trait">{trait}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fun facts */}
        {context?.fun_insights?.if_this_song_were && (
          <div className="detail-section">
            <h2>✨ If This Song Were...</h2>
            <div className="detail-synesthesia">
              {Object.entries(context.fun_insights.if_this_song_were).map(([key, value]) => (
                <div key={key} className="syn-item">
                  <span className="syn-key">{key.replace('_', ' ')}</span>
                  <span className="syn-val">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default SongDetail;