// src/pages/YouTube.js
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { useYouTube } from '../context/YoutubeContext';
import { useAuth } from '../context/AuthContext';
import { saveSongAnalysis } from '../firebase/songs';
import './YouTube.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const AXES = [
  { key: 'valence', label: 'Valence', color: '#FFD93D' },
  { key: 'energy', label: 'Energy', color: '#FF6B6B' },
  { key: 'tension', label: 'Tension', color: '#C44569' },
  { key: 'warmth', label: 'Warmth', color: '#F8B500' },
  { key: 'power', label: 'Power', color: '#6C5CE7' },
  { key: 'complexity', label: 'Complexity', color: '#00D2D3' }
];

function YouTube() {
  const { isConnected, ytUser, connectYouTube, disconnectYouTube, ytFetch } = useYouTube();
  const { user } = useAuth();
  
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentVideo: null });
  const [analyzedVideos, setAnalyzedVideos] = useState([]);
  const [failedVideos, setFailedVideos] = useState([]);
  
  // Selection states
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [savedVideos, setSavedVideos] = useState(new Set());
  
  const [error, setError] = useState(null);

  // Fetch playlists when connected
  useEffect(() => {
    if (isConnected) {
      fetchPlaylists();
    }
  }, [isConnected]);

  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const response = await ytFetch('/api/youtube/playlists');
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists);
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const analyzePlaylist = async (playlist) => {
    setSelectedPlaylist(playlist);
    setAnalyzedVideos([]);
    setFailedVideos([]);
    setSelectedVideos(new Set());
    setSavedVideos(new Set());
    setError(null);
    setIsAnalyzing(true);
    setAnalysisComplete(false);

    try {
      // Step 1: Get all videos in playlist
      setProgress({ current: 0, total: 0, currentVideo: 'Fetching playlist...' });
      
      const videosResponse = await ytFetch(`/api/youtube/playlist/${playlist.id}/videos`);
      if (!videosResponse.ok) {
        throw new Error('Failed to fetch videos');
      }
      
      const { videos, total } = await videosResponse.json();
      setProgress({ current: 0, total, currentVideo: null });

      // Step 2: Analyze each video one by one (this is the slow part)
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        
        setProgress({
          current: i + 1,
          total,
          currentVideo: video.title
        });

        // Add video to list in "analyzing" state
        setAnalyzedVideos(prev => [...prev, {
          ...video,
          analyzing: true,
          profile: null
        }]);

        try {
          // Call the analysis endpoint
          const analysisResponse = await ytFetch(`/api/youtube/analyze-video/${video.id}`, {
            method: 'POST'
          });

          if (analysisResponse.ok) {
            const result = await analysisResponse.json();
            
            // Update the video with results
            setAnalyzedVideos(prev => prev.map(v => 
              v.id === video.id 
                ? {
                    ...v,
                    analyzing: false,
                    profile: result.profile,
                    metadata: result.metadata,
                    timeSeries: result.timeSeries,
                    url: result.url
                  }
                : v
            ));
          } else {
            // Analysis failed
            setAnalyzedVideos(prev => prev.map(v => 
              v.id === video.id 
                ? { ...v, analyzing: false, failed: true }
                : v
            ));
            setFailedVideos(prev => [...prev, video.id]);
          }
        } catch (err) {
          console.error(`Failed to analyze ${video.title}:`, err);
          setAnalyzedVideos(prev => prev.map(v => 
            v.id === video.id 
              ? { ...v, analyzing: false, failed: true }
              : v
          ));
          setFailedVideos(prev => [...prev, video.id]);
        }
      }

      setIsAnalyzing(false);
      setAnalysisComplete(true);

    } catch (error) {
      console.error('Playlist analysis error:', error);
      setError('Failed to analyze playlist');
      setIsAnalyzing(false);
    }
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = analyzedVideos.filter(v => v.profile && !v.failed).map(v => v.id);
    setSelectedVideos(new Set(allIds));
  };

  const selectNone = () => {
    setSelectedVideos(new Set());
  };

  const saveSelectedVideos = async () => {
    if (!user) {
      alert('Please sign in to save');
      return;
    }
    
    if (selectedVideos.size === 0) {
      alert('Please select videos to save');
      return;
    }
    
    setSaving(true);
    
    const videosToSave = analyzedVideos.filter(v => 
      selectedVideos.has(v.id) && v.profile && !v.failed
    );
    
    for (const video of videosToSave) {
      try {
        const songData = {
          url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
          metadata: {
            title: video.metadata?.title || video.title,
            artist: video.metadata?.artist || video.channel,
            thumbnail: video.metadata?.thumbnail || video.thumbnail,
            duration: video.metadata?.duration || 0,
            source: 'youtube'
          },
          profile: video.profile,
          timeSeries: video.timeSeries || [],
          context: {
            emoji: getEmoji(video.profile),
            headline: getHeadline(video.profile),
            vibe_tags: getVibeTags(video.profile)
          }
        };
        
        await saveSongAnalysis(user.uid, songData);
        setSavedVideos(prev => new Set([...prev, video.id]));
        
      } catch (error) {
        console.error('Failed to save:', video.title, error);
      }
    }
    
    setSaving(false);
    setSelectedVideos(new Set());
  };

  // Helper functions
  const getEmoji = (profile) => {
    if (profile.energy > 0.7) return '🔥';
    if (profile.valence > 0.7) return '☀️';
    if (profile.valence < 0.3) return '🌧️';
    if (profile.warmth > 0.7) return '💛';
    if (profile.tension > 0.7) return '⚡';
    return '🎵';
  };

  const getHeadline = (profile) => {
    if (profile.energy > 0.7 && profile.valence > 0.6) return 'High-energy feel-good vibes';
    if (profile.energy > 0.7) return 'Intense and powerful';
    if (profile.valence < 0.3) return 'Melancholic and introspective';
    if (profile.warmth > 0.7) return 'Warm and inviting';
    if (profile.complexity > 0.7) return 'Complex and layered';
    return 'Balanced emotional signature';
  };

  const getVibeTags = (profile) => {
    const tags = [];
    if (profile.energy > 0.6) tags.push('energetic');
    if (profile.energy < 0.4) tags.push('chill');
    if (profile.valence > 0.6) tags.push('upbeat');
    if (profile.valence < 0.4) tags.push('moody');
    if (profile.warmth > 0.6) tags.push('warm');
    if (profile.tension > 0.6) tags.push('intense');
    return tags.slice(0, 5);
  };

  // Calculate average profile
  const successfulVideos = analyzedVideos.filter(v => v.profile && !v.failed);
  const avgProfile = successfulVideos.length > 0 ? {
    valence: successfulVideos.reduce((s, v) => s + v.profile.valence, 0) / successfulVideos.length,
    energy: successfulVideos.reduce((s, v) => s + v.profile.energy, 0) / successfulVideos.length,
    tension: successfulVideos.reduce((s, v) => s + v.profile.tension, 0) / successfulVideos.length,
    warmth: successfulVideos.reduce((s, v) => s + v.profile.warmth, 0) / successfulVideos.length,
    power: successfulVideos.reduce((s, v) => s + v.profile.power, 0) / successfulVideos.length,
    complexity: successfulVideos.reduce((s, v) => s + v.profile.complexity, 0) / successfulVideos.length,
  } : null;

  const radarData = avgProfile
    ? AXES.map(axis => ({
        axis: axis.label,
        value: avgProfile[axis.key] * 100,
        fullMark: 100
      }))
    : [];

  // Not connected
  if (!isConnected) {
    return (
      <div className="youtube-page">
        <div className="youtube-connect-container">
          <motion.div
            className="youtube-connect-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="youtube-logo">▶️</div>
            <h1>Connect YouTube</h1>
            <p>Import your playlists and get full emotional analysis with AI-generated insights for each song.</p>
            
            <button className="youtube-connect-btn" onClick={connectYouTube}>
              <svg viewBox="0 0 24 24" className="youtube-icon">
                <path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              Connect with YouTube
            </button>
            
            <div className="youtube-features">
              <div className="feature">
                <span className="feature-icon">🎵</span>
                <span>Full audio analysis</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🧠</span>
                <span>AI insights</span>
              </div>
              <div className="feature">
                <span className="feature-icon">✨</span>
                <span>Aura generation</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="youtube-page">
      {/* Header */}
      <div className="youtube-header">
        <div className="youtube-user-info">
          {ytUser?.thumbnail && (
            <img src={ytUser.thumbnail} alt="" className="youtube-avatar" />
          )}
          <div>
            <h2>Hey, {ytUser?.title || 'there'}!</h2>
            <p>Select a playlist to analyze</p>
          </div>
        </div>
        <button className="youtube-disconnect-btn" onClick={disconnectYouTube}>
          Disconnect
        </button>
      </div>

      <div className="youtube-content">
        {/* Playlists sidebar */}
        <div className="playlists-panel">
          <h3>Your Playlists</h3>
          {loadingPlaylists ? (
            <div className="playlists-loading">
              <div className="loading-spinner" />
              <p>Loading playlists...</p>
            </div>
          ) : (
            <div className="playlists-list">
              {playlists.map(playlist => (
                <motion.button
                  key={playlist.id}
                  className={`playlist-item ${selectedPlaylist?.id === playlist.id ? 'active' : ''}`}
                  onClick={() => analyzePlaylist(playlist)}
                  whileHover={{ x: 4 }}
                  disabled={isAnalyzing}
                >
                  {playlist.image ? (
                    <img src={playlist.image} alt="" className="playlist-thumb" />
                  ) : (
                    <div className="playlist-thumb-placeholder">🎵</div>
                  )}
                  <div className="playlist-info">
                    <span className="playlist-name">{playlist.name}</span>
                    <span className="playlist-tracks">
                      {playlist.tracks_count !== null ? `${playlist.tracks_count} videos` : 'Videos'}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        <div className="analysis-panel">
          <AnimatePresence mode="wait">
            {/* Analyzing state */}
            {isAnalyzing && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="analysis-progress-header">
                  <h2>{selectedPlaylist?.name}</h2>
                  <p className="progress-phase">
                    🔍 Analyzing: {progress.currentVideo || 'Starting...'}
                  </p>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar-fill youtube"
                      style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
                    />
                  </div>
                  <p className="progress-count">
                    {progress.current} / {progress.total} videos
                  </p>
                  <p className="progress-hint">
                    ☕ This takes ~10-15 seconds per song (downloading + analyzing audio)
                  </p>
                </div>

                {/* Live video list */}
                <div className="videos-section live">
                  <div className="videos-list">
                    {analyzedVideos.map((video, index) => (
                      <motion.div 
                        key={video.id} 
                        className={`video-item ${video.analyzing ? 'analyzing' : ''} ${video.failed ? 'failed' : ''}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <span className="video-number">{index + 1}</span>
                        <img src={video.thumbnail} alt="" className="video-thumb" />
                        <div className="video-info">
                          <span className="video-title">{video.title}</span>
                          <span className="video-channel">{video.channel}</span>
                        </div>
                        {video.analyzing && (
                          <div className="video-status">
                            <div className="mini-spinner youtube" />
                            <span>Analyzing...</span>
                          </div>
                        )}
                        {video.failed && (
                          <span className="failed-badge">Failed</span>
                        )}
                        {video.profile && !video.failed && (
                          <div className="video-mini-bars">
                            {['energy', 'valence', 'power'].map(key => (
                              <div key={key} className="mini-bar">
                                <div 
                                  className={`mini-fill ${key}`} 
                                  style={{ height: `${video.profile[key] * 100}%` }} 
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Complete state */}
            {analysisComplete && !isAnalyzing && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Header */}
                <div className="analyzed-header">
                  {selectedPlaylist?.image && (
                    <img src={selectedPlaylist.image} alt="" className="analyzed-cover" />
                  )}
                  <div className="analyzed-info">
                    <h2>{selectedPlaylist?.name}</h2>
                    <p>
                      {successfulVideos.length} analyzed
                      {failedVideos.length > 0 && ` • ${failedVideos.length} failed`}
                    </p>
                  </div>
                </div>

                {/* Average profile */}
                {avgProfile && (
                  <div className="profile-section">
                    <h3>Playlist Emotional Profile</h3>
                    <div className="profile-chart">
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.1)" />
                          <PolarAngleAxis dataKey="axis" tick={{ fill: '#fff', fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar dataKey="value" stroke="#FF0000" fill="#FF0000" fillOpacity={0.3} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="profile-bars">
                      {AXES.map(axis => (
                        <div key={axis.key} className="profile-bar-item">
                          <div className="bar-header">
                            <span className="bar-dot" style={{ backgroundColor: axis.color }} />
                            <span className="bar-label">{axis.label}</span>
                            <span className="bar-value">
                              {(avgProfile[axis.key] * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="bar-track">
                            <motion.div
                              className="bar-fill"
                              style={{ backgroundColor: axis.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${avgProfile[axis.key] * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selection controls */}
                <div className="selection-controls">
                  <div className="selection-info">
                    <span className="selection-count">
                      {selectedVideos.size} of {successfulVideos.length} selected
                    </span>
                    <div className="selection-buttons">
                      <button onClick={selectAll} className="select-btn">Select All</button>
                      <button onClick={selectNone} className="select-btn">Select None</button>
                    </div>
                  </div>
                  <button 
                    className="save-selected-btn youtube"
                    onClick={saveSelectedVideos}
                    disabled={saving || selectedVideos.size === 0 || !user}
                  >
                    {saving ? (
                      <>
                        <div className="mini-spinner" />
                        Saving...
                      </>
                    ) : !user ? (
                      '🔐 Sign in to Save'
                    ) : (
                      `💾 Save ${selectedVideos.size} to Profile`
                    )}
                  </button>
                </div>

                {/* Video list */}
                <div className="videos-section">
                  <h3>Videos</h3>
                  <div className="videos-list selectable">
                    {analyzedVideos.map((video, index) => (
                      <div 
                        key={video.id} 
                        className={`video-item ${selectedVideos.has(video.id) ? 'selected' : ''} ${savedVideos.has(video.id) ? 'saved' : ''} ${video.failed ? 'failed' : ''}`}
                        onClick={() => video.profile && !video.failed && !savedVideos.has(video.id) && toggleVideoSelection(video.id)}
                      >
                        {video.profile && !video.failed && (
                          <label className="video-checkbox" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={selectedVideos.has(video.id)}
                              onChange={() => toggleVideoSelection(video.id)}
                              disabled={savedVideos.has(video.id)}
                            />
                            <span className="checkmark" />
                          </label>
                        )}
                        <span className="video-number">{index + 1}</span>
                        <img src={video.thumbnail} alt="" className="video-thumb" />
                        <div className="video-info">
                          <span className="video-title">{video.title}</span>
                          <span className="video-channel">{video.channel}</span>
                        </div>
                        {savedVideos.has(video.id) && (
                          <span className="saved-badge">Saved ✓</span>
                        )}
                        {video.failed && (
                          <span className="failed-badge">Failed</span>
                        )}
                        {video.profile && !video.failed && !savedVideos.has(video.id) && (
                          <div className="video-mini-bars">
                            {['energy', 'valence', 'power'].map(key => (
                              <div key={key} className="mini-bar">
                                <div 
                                  className={`mini-fill ${key}`} 
                                  style={{ height: `${video.profile[key] * 100}%` }} 
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!isAnalyzing && !analysisComplete && (
              <motion.div
                key="empty"
                className="analysis-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="empty-emoji">👈</span>
                <h3>Select a playlist</h3>
                <p>Choose a playlist to analyze. Each video will be downloaded and analyzed for its emotional profile.</p>
                <p className="empty-hint">⏱️ Tip: Start with smaller playlists (5-10 videos) for faster results</p>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="analysis-error">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default YouTube;