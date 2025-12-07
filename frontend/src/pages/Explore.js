// src/pages/Explore.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRecentPublicSongs } from '../firebase/songs';
import SongCard from '../components/SongCard';
import './Explore.css';

function Explore() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    try {
      const recentSongs = await getRecentPublicSongs(30);
      setSongs(recentSongs);
    } catch (err) {
      console.error('Error loading songs:', err);
      setError('Failed to load songs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="explore-page">
      <motion.div 
        className="explore-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Explore</h1>
        <p>Discover what others are listening to and their emotional profiles</p>
      </motion.div>

      <div className="explore-content">
        {loading ? (
          <div className="explore-loading">
            <div className="loading-spinner large" />
            <p>Loading songs...</p>
          </div>
        ) : error ? (
          <div className="explore-error">
            <p>{error}</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="explore-empty">
            <span className="empty-emoji">🎵</span>
            <p>No songs analyzed yet. Be the first!</p>
          </div>
        ) : (
          <div className="songs-grid">
            {songs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <SongCard song={song} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Explore;