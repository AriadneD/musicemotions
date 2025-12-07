import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip
} from 'recharts';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const AXES = [
  { key: 'valence', label: 'Valence', fullLabel: 'Sad ↔ Happy', color: '#FFD93D' },
  { key: 'energy', label: 'Energy', fullLabel: 'Calm ↔ Intense', color: '#FF6B6B' },
  { key: 'tension', label: 'Tension', fullLabel: 'Relaxed ↔ Suspenseful', color: '#C44569' },
  { key: 'warmth', label: 'Warmth', fullLabel: 'Cold ↔ Affectionate', color: '#F8B500' },
  { key: 'power', label: 'Power', fullLabel: 'Intimate ↔ Epic', color: '#6C5CE7' },
  { key: 'complexity', label: 'Complexity', fullLabel: 'Simple ↔ Intricate', color: '#00D2D3' }
];

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('radar');
  const [activeTab, setActiveTab] = useState('overview');

  const analyzeTrack = async () => {
    if (!url.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') analyzeTrack();
  };

  const radarData = result?.profile
    ? AXES.map(axis => ({
        axis: axis.label,
        value: result.profile[axis.key] * 100,
        fullMark: 100
      }))
    : [];

  const ctx = result?.context;

  return (
    <div className="app">
      <div className="bg-gradient" />
      <div className="bg-noise" />
      
      <header className="header">
        <motion.div 
          className="logo"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="logo-emoji">🎶</span>
          <span className="logo-text">wayve</span>
        </motion.div>
        <p className="tagline">The emotional DNA of your music.</p>
      </header>

      <main className="main">
        <motion.section 
          className="input-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="input-wrapper">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Paste a YouTube URL..."
              className="url-input"
              disabled={loading}
            />
            <button 
              onClick={analyzeTrack} 
              className="analyze-btn"
              disabled={loading || !url.trim()}
            >
              {loading ? <span className="loading-spinner" /> : 'Analyze'}
            </button>
          </div>
        </motion.section>

        <AnimatePresence>
          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <span className="error-icon">⚠️</span>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {loading && (
            <motion.div 
              className="loading-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="loading-visual">
                <div className="pulse-ring" />
                <div className="pulse-ring delay-1" />
                <div className="pulse-ring delay-2" />
                <span className="loading-emoji">🎵</span>
              </div>
              <p className="loading-text">Analyzing emotional frequencies...</p>
              <p className="loading-subtext">Downloading audio, extracting features, consulting the banana oracle...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && !loading && (
            <motion.div 
              className="results"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Song Header */}
              <div className="song-header">
                {result.metadata.thumbnail && (
                  <div className="thumbnail-wrapper">
                    <img src={result.metadata.thumbnail} alt="Album art" className="thumbnail" />
                    <div className="thumbnail-glow" />
                  </div>
                )}
                <div className="song-info">
                  <span className="context-emoji">{ctx?.emoji || '🎵'}</span>
                  <h2 className="song-title">{result.metadata.title}</h2>
                  <p className="song-artist">{result.metadata.artist}</p>
                  <p className="song-headline">{ctx?.headline}</p>
                  {ctx?.vibe_tags && (
                    <div className="vibe-tags">
                      {ctx.vibe_tags.map((tag, i) => (
                        <span key={i} className="vibe-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="tab-navigation">
                {[
                  { id: 'overview', label: '📊 Overview', icon: '📊' },
                  { id: 'psychology', label: '🧠 Psychology', icon: '🧠' },
                  { id: 'context', label: '📍 Context', icon: '📍' },
                  { id: 'playlist', label: '🎧 Playlist', icon: '🎧' },
                  { id: 'fun', label: '✨ Fun', icon: '✨' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <motion.div 
                  className="tab-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {/* View Toggle */}
                  <div className="view-toggle">
                    <button 
                      className={`toggle-btn ${activeView === 'radar' ? 'active' : ''}`}
                      onClick={() => setActiveView('radar')}
                    >
                      Emotional Profile
                    </button>
                    <button 
                      className={`toggle-btn ${activeView === 'timeline' ? 'active' : ''}`}
                      onClick={() => setActiveView('timeline')}
                    >
                      Timeline
                    </button>
                  </div>

                  {/* Charts */}
                  <div className="chart-container">
                    {activeView === 'radar' ? (
                      <div className="radar-wrapper">
                        <ResponsiveContainer width="100%" height={350}>
                          <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                            <PolarAngleAxis dataKey="axis" tick={{ fill: '#fff', fontSize: 12, fontWeight: 500 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} />
                            <Radar name="Profile" dataKey="value" stroke="#FFD93D" fill="url(#radarGradient)" fillOpacity={0.6} strokeWidth={2} />
                            <defs>
                              <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FFD93D" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.3} />
                              </linearGradient>
                            </defs>
                          </RadarChart>
                        </ResponsiveContainer>
                        
                        <div className="axis-details">
                          {AXES.map((axis) => (
                            <div key={axis.key} className="axis-item">
                              <div className="axis-header">
                                <span className="axis-dot" style={{ backgroundColor: axis.color }} />
                                <span className="axis-name">{axis.label}</span>
                              </div>
                              <div className="axis-bar-wrapper">
                                <motion.div 
                                  className="axis-bar"
                                  style={{ backgroundColor: axis.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${result.profile[axis.key] * 100}%` }}
                                  transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
                                />
                              </div>
                              <span className="axis-value">{(result.profile[axis.key] * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="timeline-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={result.timeSeries}>
                            <defs>
                              {AXES.map((axis) => (
                                <linearGradient key={axis.key} id={`gradient-${axis.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={axis.color} stopOpacity={0.8} />
                                  <stop offset="100%" stopColor={axis.color} stopOpacity={0.1} />
                                </linearGradient>
                              ))}
                            </defs>
                            <XAxis dataKey="time_sec" stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                            <YAxis domain={[0, 1]} stroke="rgba(255,255,255,0.3)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                            {AXES.map((axis) => (
                              <Area key={axis.key} type="monotone" dataKey={axis.key} stroke={axis.color} fill={`url(#gradient-${axis.key})`} strokeWidth={2} />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="timeline-legend">
                          {AXES.map((axis) => (
                            <div key={axis.key} className="legend-item">
                              <span className="legend-color" style={{ backgroundColor: axis.color }} />
                              <span>{axis.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deep Analysis */}
                  {ctx?.deep_analysis && (
                    <div className="analysis-section">
                      <h3 className="section-title">Deep Analysis</h3>
                      <div className="analysis-cards">
                        <div className="analysis-card">
                          <h4>🎭 Emotional Narrative</h4>
                          <p>{ctx.deep_analysis.emotional_narrative}</p>
                        </div>
                        <div className="analysis-card">
                          <h4>🔊 Sonic Character</h4>
                          <p>{ctx.deep_analysis.sonic_character}</p>
                        </div>
                        <div className="analysis-card highlight">
                          <h4>⭐ Standout Quality</h4>
                          <p>{ctx.deep_analysis.standout_quality}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeline Analysis */}
                  {ctx?.timeline_analysis && (
                    <div className="analysis-section">
                      <h3 className="section-title">Emotional Arc</h3>
                      <div className="arc-badge">{ctx.timeline_analysis.overall_arc}</div>
                      <div className="timeline-analysis">
                        <div className="timeline-phase">
                          <div className="phase-marker opening">1</div>
                          <div className="phase-content">
                            <h4>Opening</h4>
                            <p>{ctx.timeline_analysis.opening}</p>
                          </div>
                        </div>
                        <div className="timeline-phase">
                          <div className="phase-marker middle">2</div>
                          <div className="phase-content">
                            <h4>Development</h4>
                            <p>{ctx.timeline_analysis.development}</p>
                          </div>
                        </div>
                        <div className="timeline-phase">
                          <div className="phase-marker closing">3</div>
                          <div className="phase-content">
                            <h4>Conclusion</h4>
                            <p>{ctx.timeline_analysis.conclusion}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* PSYCHOLOGY TAB */}
              {activeTab === 'psychology' && ctx?.listener_psychology && (
                <motion.div 
                  className="tab-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="psychology-section">
                    <h3 className="section-title">What This Song Says About You</h3>
                    
                    <div className="psychology-insight-card">
                      <p className="insight-text">{ctx.listener_psychology.psychology_insight}</p>
                    </div>

                    <div className="psychology-grid">
                      <div className="psych-card">
                        <h4>🎯 Personality Traits</h4>
                        <div className="trait-tags">
                          {ctx.listener_psychology.personality_traits?.map((trait, i) => (
                            <span key={i} className="trait-tag">{trait}</span>
                          ))}
                        </div>
                      </div>

                      <div className="psych-card">
                        <h4>💭 Emotional Need</h4>
                        <p>{ctx.listener_psychology.emotional_needs}</p>
                      </div>

                      <div className="psych-card">
                        <h4>🔮 MBTI Vibes</h4>
                        <p className="mbti-text">{ctx.listener_psychology.mbti_vibes}</p>
                      </div>
                    </div>

                    {ctx?.demographics && (
                      <>
                        <h3 className="section-title" style={{ marginTop: '2rem' }}>Listener Demographics</h3>
                        <div className="demographics-grid">
                          <div className="demo-item">
                            <span className="demo-label">Age Range</span>
                            <span className="demo-value">{ctx.demographics.age_range}</span>
                          </div>
                          <div className="demo-item">
                            <span className="demo-label">Lifestyle</span>
                            <span className="demo-value">{ctx.demographics.lifestyle}</span>
                          </div>
                          <div className="demo-item">
                            <span className="demo-label">Aesthetic</span>
                            <span className="demo-value">{ctx.demographics.aesthetic}</span>
                          </div>
                          <div className="demo-item">
                            <span className="demo-label">Subculture</span>
                            <span className="demo-value">{ctx.demographics.subculture}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* CONTEXT TAB */}
              {activeTab === 'context' && ctx?.context_recommendations && (
                <motion.div 
                  className="tab-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="context-section">
                    <h3 className="section-title">📍 Best Places to Listen</h3>
                    <div className="locations-grid">
                      {ctx.context_recommendations.locations?.map((loc, i) => (
                        <div key={i} className="location-card">
                          <h4>{loc.place}</h4>
                          <p>{loc.why}</p>
                          <span className="vibe-match-tag">{loc.vibe_match}</span>
                        </div>
                      ))}
                    </div>

                    <h3 className="section-title">🎯 Perfect Activities</h3>
                    <div className="activities-grid">
                      {ctx.context_recommendations.activities?.map((act, i) => (
                        <div key={i} className="activity-card">
                          <h4>{act.activity}</h4>
                          <p>{act.why}</p>
                        </div>
                      ))}
                    </div>

                    {ctx.context_recommendations.seasons && (
                      <>
                        <h3 className="section-title">🌤️ Ideal Conditions</h3>
                        <div className="conditions-grid">
                          <div className="condition-card">
                            <span className="condition-icon">🗓️</span>
                            <span className="condition-label">Season</span>
                            <span className="condition-value">{ctx.context_recommendations.seasons.best}</span>
                            <span className="condition-why">{ctx.context_recommendations.seasons.why}</span>
                          </div>
                          <div className="condition-card">
                            <span className="condition-icon">🕐</span>
                            <span className="condition-label">Time</span>
                            <span className="condition-value">{ctx.context_recommendations.seasons.time_of_day}</span>
                          </div>
                          <div className="condition-card">
                            <span className="condition-icon">⛅</span>
                            <span className="condition-label">Weather</span>
                            <span className="condition-value">{ctx.context_recommendations.seasons.weather}</span>
                          </div>
                          <div className="condition-card">
                            <span className="condition-icon">👥</span>
                            <span className="condition-label">Social</span>
                            <span className="condition-value">{ctx.context_recommendations.social_context}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              {/* PLAYLIST TAB */}
              {activeTab === 'playlist' && ctx?.playlist_recommendations && (
                <motion.div 
                  className="tab-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="playlist-section">
                    <div className="playlist-header-card">
                      <h3 className="playlist-name">🎧 {ctx.playlist_recommendations.playlist_name}</h3>
                      <p className="playlist-vibe">{ctx.playlist_recommendations.playlist_vibe}</p>
                    </div>

                    <h3 className="section-title">Similar Energy Songs</h3>
                    <div className="similar-songs">
                      {ctx.playlist_recommendations.similar_energy_songs?.map((song, i) => (
                        <div key={i} className="song-suggestion">
                          <span className="song-number">{i + 1}</span>
                          <span className="song-name">{song}</span>
                        </div>
                      ))}
                    </div>

                    {ctx.playlist_recommendations.unexpected_pairing && (
                      <div className="unexpected-pairing">
                        <h4>🎲 Unexpected Pairing</h4>
                        <p>{ctx.playlist_recommendations.unexpected_pairing}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* FUN TAB */}
              {activeTab === 'fun' && ctx?.fun_insights && (
                <motion.div 
                  className="tab-content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="fun-section">
                    <h3 className="section-title">If This Song Were...</h3>
                    <div className="synesthesia-grid">
                      {ctx.fun_insights.if_this_song_were && Object.entries(ctx.fun_insights.if_this_song_were).map(([key, value]) => (
                        <div key={key} className="synesthesia-card">
                          <span className="syn-label">{key.replace('_', ' ')}</span>
                          <span className="syn-value">{value}</span>
                        </div>
                      ))}
                    </div>

                    {ctx.fun_insights.conversation_starter && (
                      <div className="conversation-starter">
                        <h4>💬 Conversation Starter</h4>
                        <p>"{ctx.fun_insights.conversation_starter}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!result && !loading && !error && (
          <motion.div 
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="empty-visual">
              <span className="empty-emoji">🎧</span>
            </div>
            <h3>Discover the Emotional DNA of Music</h3>
            <p>
              Paste any YouTube link to analyze its emotional profile across six dimensions: 
              valence, energy, tension, warmth, power, and complexity.
            </p>
          </motion.div>
        )}
      </main>

      <footer className="footer">
        <p>Built by Ari & Audrey</p>
      </footer>
    </div>
  );
}

export default App;