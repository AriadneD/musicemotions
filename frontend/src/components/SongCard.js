// src/components/SongCard.js
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './SongCard.css';

function SongCard({ song, showActions = false, onDelete, onToggleVisibility }) {
  const { metadata, profile, context, isPublic, id } = song;

  return (
    <motion.div 
      className="song-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
    >
      <Link to={`/song/${id}`} className="song-card-link">
        <div className="song-card-thumbnail">
          {metadata?.thumbnail ? (
            <img src={metadata.thumbnail} alt={metadata.title} />
          ) : (
            <div className="song-card-placeholder">🎵</div>
          )}
          <div className="song-card-overlay">
            <span className="song-emoji">{context?.emoji || '🎵'}</span>
          </div>
        </div>
        
        <div className="song-card-content">
          <h3 className="song-card-title">{metadata?.title || 'Unknown Song'}</h3>
          <p className="song-card-artist">{metadata?.artist || 'Unknown Artist'}</p>
          
          {context?.headline && (
            <p className="song-card-headline">{context.headline}</p>
          )}
          
          {profile && (
            <div className="song-card-stats">
              <div className="stat">
                <span className="stat-label">Energy</span>
                <div className="stat-bar">
                  <div 
                    className="stat-fill energy" 
                    style={{ width: `${profile.energy * 100}%` }}
                  />
                </div>
              </div>
              <div className="stat">
                <span className="stat-label">Valence</span>
                <div className="stat-bar">
                  <div 
                    className="stat-fill valence" 
                    style={{ width: `${profile.valence * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {context?.vibe_tags && (
            <div className="song-card-tags">
              {context.vibe_tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="song-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </Link>
      
      {showActions && (
        <div className="song-card-actions">
          <button 
            className={`action-btn visibility ${isPublic ? 'public' : 'private'}`}
            onClick={(e) => {
              e.preventDefault();
              onToggleVisibility?.(id, !isPublic);
            }}
            title={isPublic ? 'Make Private' : 'Make Public'}
          >
            {isPublic ? '🌍' : '🔒'}
          </button>
          <button 
            className="action-btn delete"
            onClick={(e) => {
              e.preventDefault();
              if (window.confirm('Delete this song analysis?')) {
                onDelete?.(id);
              }
            }}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default SongCard;