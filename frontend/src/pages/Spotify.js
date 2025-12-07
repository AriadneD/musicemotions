// src/pages/Spotify.js
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer
} from 'recharts';
import { useSpotify } from '../context/SpotifyContext';
import { useAuth } from '../context/AuthContext';
import { saveSongAnalysis } from '../firebase/songs';
import './Spotify.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const AXES = [
  { key: 'valence', label: 'Valence', color: '#FFD93D' },
  { key: 'energy', label: 'Energy', color: '#FF6B6B' },
  { key: 'tension', label: 'Tension', color: '#C44569' },
  { key: 'warmth', label: 'Warmth', color: '#F8B500' },
  { key: 'power', label: 'Power', color: '#6C5CE7' },
  { key: 'complexity', label: 'Complexity', color: '#00D2D3' }
];

function Spotify() {
  const { isConnected, spotifyUser, connectSpotify, disconnectSpotify, spotifyFetch } = useSpotify();
  const { user } = useAuth();
  
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [analyzedData, setAnalyzedData] = useState(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  // Progressive loading states
  const [analysisPhase, setAnalysisPhase] = useState(null); // 'fetching' | 'analyzing' | 'complete'
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTrack: null });
  const [tracksBeingAnalyzed, setTracksBeingAnalyzed] = useState([]);
  
  // Selection states
  const [selectedTracks, setSelectedTracks] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [savedTracks, setSavedTracks] = useState(new Set());
  
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
      const response = await spotifyFetch('/api/spotify/playlists');
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
    setAnalyzedData(null);
    setError(null);
    setSelectedTracks(new Set());
    setSavedTracks(new Set());
    setTracksBeingAnalyzed([]);
    
    // Phase 1: Fetching tracks
    setAnalysisPhase('fetching');
    setProgress({ current: 0, total: playlist.tracks_count, currentTrack: null });

    try {
      // Get tracks with simulated progress
      const tracksResponse = await spotifyFetch(`/api/spotify/playlist/${playlist.id}/tracks`);
      if (!tracksResponse.ok) {
        throw new Error('Failed to fetch tracks');
      }
      const { tracks } = await tracksResponse.json();
      
      setProgress({ current: tracks.length, total: tracks.length, currentTrack: null });
      
      // Phase 2: Analyzing with visual progress
      setAnalysisPhase('analyzing');
      
      // Add tracks progressively to the UI
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        setProgress({ 
          current: i + 1, 
          total: tracks.length, 
          currentTrack: track.name 
        });
        
        // Add to visible list with loading state
        setTracksBeingAnalyzed(prev => [...prev, { ...track, analyzing: true }]);
        
        // Small delay for visual effect
        await new Promise(r => setTimeout(r, 30));
      }
      
      // Now fetch audio features
      const trackIds = tracks.map(t => t.id);
      console.log('Fetching audio features for', trackIds.length, 'tracks');
      
      const featuresResponse = await spotifyFetch('/api/spotify/audio-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_ids: trackIds })
      });
      
      if (!featuresResponse.ok) {
        const errorText = await featuresResponse.text();
        console.error('Audio features error:', featuresResponse.status, errorText);
        throw new Error('Failed to get audio features');
      }
      
      const featuresData = await featuresResponse.json();
      const features = featuresData.features || {};
      const apiRestricted = featuresData.api_restricted || false;
      
      console.log('Got features for', Object.keys(features).length, 'tracks');
      
      if (apiRestricted) {
        console.warn('Spotify Audio Features API is restricted for this app');
        setError('⚠️ Spotify Audio Features API requires Extended Quota Mode. Tracks imported without emotional profiles. Apply at developer.spotify.com to enable full analysis.');
      }
      
      // Update tracks with their profiles progressively
      const analyzedTracks = [];
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const featureData = features[track.id];
        
        const analyzedTrack = {
          ...track,
          profile: featureData?.axes || null,
          spotify_features: featureData?.spotify_features || null,
          analyzing: false
        };
        
        analyzedTracks.push(analyzedTrack);
        
        // Update the track in the list
        setTracksBeingAnalyzed(prev => {
          const updated = [...prev];
          updated[i] = analyzedTrack;
          return updated;
        });
        
        // Small delay for visual effect
        await new Promise(r => setTimeout(r, 20));
      }
      
      // Calculate average profile
      const profiles = analyzedTracks.filter(t => t.profile).map(t => t.profile);
      const avgProfile = profiles.length > 0 ? {
        valence: profiles.reduce((s, p) => s + p.valence, 0) / profiles.length,
        energy: profiles.reduce((s, p) => s + p.energy, 0) / profiles.length,
        tension: profiles.reduce((s, p) => s + p.tension, 0) / profiles.length,
        warmth: profiles.reduce((s, p) => s + p.warmth, 0) / profiles.length,
        power: profiles.reduce((s, p) => s + p.power, 0) / profiles.length,
        complexity: profiles.reduce((s, p) => s + p.complexity, 0) / profiles.length,
      } : null;
      
      setAnalyzedData({
        tracks: analyzedTracks,
        total: analyzedTracks.length,
        average_profile: avgProfile
      });
      
      setAnalysisPhase('complete');
      
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to analyze playlist');
      setAnalysisPhase(null);
    }
  };

  const toggleTrackSelection = (trackId) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (!analyzedData) return;
    // Select all tracks (with or without profiles)
    const allIds = analyzedData.tracks.map(t => t.id);
    setSelectedTracks(new Set(allIds));
  };

  const selectNone = () => {
    setSelectedTracks(new Set());
  };

  const saveSelectedTracks = async () => {
    if (!user) {
      alert('Please sign in to save tracks');
      return;
    }
    
    if (selectedTracks.size === 0) {
      alert('Please select tracks to save');
      return;
    }
    
    setSaving(true);
    
    const tracksToSave = analyzedData.tracks.filter(t => selectedTracks.has(t.id));
    
    for (const track of tracksToSave) {
      try {
        // Create default profile if none exists
        const defaultProfile = {
          valence: 0.5,
          energy: 0.5,
          tension: 0.5,
          warmth: 0.5,
          power: 0.5,
          complexity: 0.5
        };
        
        const profile = track.profile || defaultProfile;
        
        // Format for saveSongAnalysis
        const songData = {
          url: `https://open.spotify.com/track/${track.id}`,
          metadata: {
            title: track.name,
            artist: track.artist,
            thumbnail: track.image,
            duration: Math.round(track.duration_ms / 1000),
            source: 'spotify'
          },
          profile: profile,
          timeSeries: [],
          context: {
            emoji: track.profile ? getEmoji(profile) : '🎵',
            headline: track.profile ? getHeadline(profile) : 'Imported from Spotify',
            vibe_tags: track.profile ? getVibeTags(profile) : ['spotify', 'imported']
          }
        };
        
        await saveSongAnalysis(user.uid, songData);
        setSavedTracks(prev => new Set([...prev, track.id]));
        
      } catch (error) {
        console.error('Failed to save track:', track.name, error);
      }
    }
    
    setSaving(false);
    setSelectedTracks(new Set());
  };

  // Helper functions for generating basic context
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
    if (profile.power > 0.6) tags.push('powerful');
    if (profile.complexity > 0.6) tags.push('intricate');
    return tags.slice(0, 5);
  };

  const radarData = analyzedData?.average_profile
    ? AXES.map(axis => ({
        axis: axis.label,
        value: analyzedData.average_profile[axis.key] * 100,
        fullMark: 100
      }))
    : [];

  // Not connected - show connect button
  if (!isConnected) {
    return (
      <div className="spotify-page">
        <div className="spotify-connect-container">
          <motion.div
            className="spotify-connect-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="spotify-logo">🎧</div>
            <h1>Connect Spotify</h1>
            <p>Import your playlists and analyze the emotional profile of your music collection.</p>
            
            <button className="spotify-connect-btn" onClick={connectSpotify}>
              <svg viewBox="0 0 24 24" className="spotify-icon">
                <path fill="currentColor" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Connect with Spotify
            </button>
            
            <div className="spotify-features">
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <span>Instant analysis</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📊</span>
                <span>Batch processing</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🎵</span>
                <span>All your playlists</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-page">
      {/* Header */}
      <div className="spotify-header">
        <div className="spotify-user-info">
          {spotifyUser?.images?.[0] && (
            <img src={spotifyUser.images[0].url} alt="" className="spotify-avatar" />
          )}
          <div>
            <h2>Hey, {spotifyUser?.display_name || 'there'}!</h2>
            <p>Select a playlist to analyze</p>
          </div>
        </div>
        <button className="spotify-disconnect-btn" onClick={disconnectSpotify}>
          Disconnect
        </button>
      </div>

      <div className="spotify-content">
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
                  disabled={analysisPhase && analysisPhase !== 'complete'}
                >
                  {playlist.image ? (
                    <img src={playlist.image} alt="" className="playlist-thumb" />
                  ) : (
                    <div className="playlist-thumb-placeholder">🎵</div>
                  )}
                  <div className="playlist-info">
                    <span className="playlist-name">{playlist.name}</span>
                    <span className="playlist-tracks">{playlist.tracks_count} tracks</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Analysis panel */}
        <div className="analysis-panel">
          <AnimatePresence mode="wait">
            {/* Loading/Analyzing State */}
            {analysisPhase && analysisPhase !== 'complete' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Progress Header */}
                <div className="analysis-progress-header">
                  <div className="progress-info">
                    <h2>{selectedPlaylist?.name}</h2>
                    <p className="progress-phase">
                      {analysisPhase === 'fetching' ? '📥 Fetching tracks...' : '🔍 Analyzing audio features...'}
                    </p>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar-fill"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="progress-count">
                      {progress.current} / {progress.total} tracks
                      {progress.currentTrack && <span className="current-track"> • {progress.currentTrack}</span>}
                    </p>
                  </div>
                </div>

                {/* Tracks appearing in real-time */}
                {tracksBeingAnalyzed.length > 0 && (
                  <div className="tracks-section live">
                    <div className="tracks-list">
                      {tracksBeingAnalyzed.map((track, index) => (
                        <motion.div 
                          key={track.id} 
                          className={`track-item ${track.analyzing ? 'analyzing' : ''}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className="track-number">{index + 1}</span>
                          {track.image ? (
                            <img src={track.image} alt="" className="track-thumb" />
                          ) : (
                            <div className="track-thumb-placeholder">🎵</div>
                          )}
                          <div className="track-info">
                            <span className="track-name">{track.name}</span>
                            <span className="track-artist">{track.artist}</span>
                          </div>
                          {track.analyzing ? (
                            <div className="track-analyzing-indicator">
                              <div className="mini-spinner" />
                            </div>
                          ) : track.profile ? (
                            <div className="track-mini-bars">
                              <div className="mini-bar" title={`Energy: ${(track.profile.energy * 100).toFixed(0)}%`}>
                                <div className="mini-fill energy" style={{ height: `${track.profile.energy * 100}%` }} />
                              </div>
                              <div className="mini-bar" title={`Valence: ${(track.profile.valence * 100).toFixed(0)}%`}>
                                <div className="mini-fill valence" style={{ height: `${track.profile.valence * 100}%` }} />
                              </div>
                              <div className="mini-bar" title={`Power: ${(track.profile.power * 100).toFixed(0)}%`}>
                                <div className="mini-fill power" style={{ height: `${track.profile.power * 100}%` }} />
                              </div>
                            </div>
                          ) : null}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Completed Analysis */}
            {analysisPhase === 'complete' && analyzedData && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {/* Playlist header */}
                <div className="analyzed-header">
                  {selectedPlaylist?.image && (
                    <img src={selectedPlaylist.image} alt="" className="analyzed-cover" />
                  )}
                  <div className="analyzed-info">
                    <h2>{selectedPlaylist?.name}</h2>
                    <p>{analyzedData.total} tracks analyzed</p>
                  </div>
                </div>

                {/* Average profile */}
                {analyzedData.average_profile && (
                  <div className="profile-section">
                    <h3>Playlist Emotional Profile</h3>
                    <div className="profile-chart">
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.1)" />
                          <PolarAngleAxis dataKey="axis" tick={{ fill: '#fff', fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar dataKey="value" stroke="#1DB954" fill="#1DB954" fillOpacity={0.3} strokeWidth={2} />
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
                              {(analyzedData.average_profile[axis.key] * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="bar-track">
                            <motion.div
                              className="bar-fill"
                              style={{ backgroundColor: axis.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${analyzedData.average_profile[axis.key] * 100}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
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
                      {selectedTracks.size} of {analyzedData.tracks.length} selected
                    </span>
                    <div className="selection-buttons">
                      <button onClick={selectAll} className="select-btn">Select All</button>
                      <button onClick={selectNone} className="select-btn">Select None</button>
                    </div>
                  </div>
                  <button 
                    className="save-selected-btn"
                    onClick={saveSelectedTracks}
                    disabled={saving || selectedTracks.size === 0 || !user}
                  >
                    {saving ? (
                      <>
                        <div className="mini-spinner" />
                        Saving...
                      </>
                    ) : !user ? (
                      '🔐 Sign in to Save'
                    ) : (
                      `💾 Save ${selectedTracks.size} to Profile`
                    )}
                  </button>
                </div>

                {/* Track list with checkboxes */}
                <div className="tracks-section">
                  <h3>Tracks</h3>
                  <div className="tracks-list selectable">
                    {analyzedData.tracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        className={`track-item ${selectedTracks.has(track.id) ? 'selected' : ''} ${savedTracks.has(track.id) ? 'saved' : ''}`}
                        onClick={() => !savedTracks.has(track.id) && toggleTrackSelection(track.id)}
                      >
                        <label className="track-checkbox" onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={selectedTracks.has(track.id)}
                            onChange={() => toggleTrackSelection(track.id)}
                            disabled={savedTracks.has(track.id)}
                          />
                          <span className="checkmark">
                            {savedTracks.has(track.id) ? '✓' : ''}
                          </span>
                        </label>
                        <span className="track-number">{index + 1}</span>
                        {track.image ? (
                          <img src={track.image} alt="" className="track-thumb" />
                        ) : (
                          <div className="track-thumb-placeholder">🎵</div>
                        )}
                        <div className="track-info">
                          <span className="track-name">{track.name}</span>
                          <span className="track-artist">{track.artist}</span>
                        </div>
                        {savedTracks.has(track.id) && (
                          <span className="saved-badge">Saved ✓</span>
                        )}
                        {!savedTracks.has(track.id) && track.profile && (
                          <div className="track-mini-bars">
                            <div className="mini-bar" title={`Energy: ${(track.profile.energy * 100).toFixed(0)}%`}>
                              <div className="mini-fill energy" style={{ height: `${track.profile.energy * 100}%` }} />
                            </div>
                            <div className="mini-bar" title={`Valence: ${(track.profile.valence * 100).toFixed(0)}%`}>
                              <div className="mini-fill valence" style={{ height: `${track.profile.valence * 100}%` }} />
                            </div>
                            <div className="mini-bar" title={`Power: ${(track.profile.power * 100).toFixed(0)}%`}>
                              <div className="mini-fill power" style={{ height: `${track.profile.power * 100}%` }} />
                            </div>
                          </div>
                        )}
                        {!savedTracks.has(track.id) && !track.profile && (
                          <span className="no-analysis-badge">No analysis</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!analysisPhase && !analyzedData && (
              <motion.div
                key="empty"
                className="analysis-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="empty-emoji">👈</span>
                <h3>Select a playlist</h3>
                <p>Choose a playlist from the left to analyze its emotional profile</p>
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

export default Spotify;