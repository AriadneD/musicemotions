// src/pages/Profile.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getUserByUsername, getUserById, getPublicUserSongs, getUserSongs, deleteSong, updateSongVisibility } from '../firebase/songs';
import SongCard from '../components/SongCard';
import './Profile.css';

function Profile() {
  const { username } = useParams();
  const { user, userProfile } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if this is the current user's profile
  const isOwnProfile = user && (
    userProfile?.username === username || 
    user.uid === username ||
    userProfile?.id === username
  );

  useEffect(() => {
    loadProfile();
  }, [username, user, userProfile]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      let foundUser = null;

      // If viewing own profile via UID and we have userProfile, use it directly
      if (user && (user.uid === username || userProfile?.id === username) && userProfile) {
        foundUser = userProfile;
      } else {
        // Try to find user by username first
        foundUser = await getUserByUsername(username);
        
        // If not found by username, try by ID
        if (!foundUser) {
          foundUser = await getUserById(username);
        }
      }

      if (!foundUser) {
        // If this is the current user but no profile exists yet, create a temporary one
        if (user && user.uid === username) {
          foundUser = {
            id: user.uid,
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            username: user.email?.split('@')[0] || user.uid,
            email: user.email,
            bio: ''
          };
        } else {
          setError('User not found');
          setLoading(false);
          return;
        }
      }

      setProfileUser(foundUser);

      // Load songs - all songs if own profile, only public if viewing others
      const userId = foundUser.id || foundUser.uid;
      
      try {
        const userSongs = isOwnProfile 
          ? await getUserSongs(userId)
          : await getPublicUserSongs(userId);
        setSongs(userSongs);
      } catch (songError) {
        console.error('Error loading songs:', songError);
        // Don't fail the whole page if songs fail to load
        setSongs([]);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSong = async (songId) => {
    try {
      await deleteSong(songId);
      setSongs(songs.filter(s => s.id !== songId));
    } catch (err) {
      console.error('Error deleting song:', err);
    }
  };

  const handleToggleVisibility = async (songId, isPublic) => {
    try {
      await updateSongVisibility(songId, isPublic);
      setSongs(songs.map(s => 
        s.id === songId ? { ...s, isPublic } : s
      ));
    } catch (err) {
      console.error('Error updating visibility:', err);
    }
  };

  // Calculate aggregate stats
  const calculateStats = () => {
    if (songs.length === 0) return null;

    const avg = (key) => {
      const sum = songs.reduce((acc, s) => acc + (s.profile?.[key] || 0), 0);
      return (sum / songs.length * 100).toFixed(0);
    };

    return {
      totalSongs: songs.length,
      avgEnergy: avg('energy'),
      avgValence: avg('valence'),
      avgWarmth: avg('warmth'),
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="loading-spinner large" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <span className="error-emoji">😕</span>
          <h2>{error}</h2>
          <Link to="/" className="back-link">← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <motion.div 
        className="profile-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="profile-avatar-section">
          <img 
            src={profileUser?.photoURL || '/default-avatar.png'} 
            alt={profileUser?.displayName}
            className="profile-avatar"
          />
          {isOwnProfile && (
            <Link to="/settings" className="edit-profile-btn">
              ✏️ Edit
            </Link>
          )}
        </div>

        <div className="profile-info">
          <h1 className="profile-name">{profileUser?.displayName}</h1>
          <p className="profile-username">@{profileUser?.username}</p>
          {profileUser?.bio && (
            <p className="profile-bio">{profileUser.bio}</p>
          )}
        </div>

        {stats && (
          <div className="profile-stats">
            <div className="stat-box">
              <span className="stat-number">{stats.totalSongs}</span>
              <span className="stat-label">Songs Analyzed</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{stats.avgEnergy}%</span>
              <span className="stat-label">Avg Energy</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{stats.avgValence}%</span>
              <span className="stat-label">Avg Valence</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{stats.avgWarmth}%</span>
              <span className="stat-label">Avg Warmth</span>
            </div>
          </div>
        )}

        <div className="profile-share">
          <span className="share-label">Share your profile:</span>
          <code className="share-url">wayve.app/profile/{profileUser?.username}</code>
        </div>
      </motion.div>

      <div className="profile-content">
        <div className="section-header">
          <h2>
            {isOwnProfile ? 'Your Analyzed Songs' : 'Analyzed Songs'}
          </h2>
          {isOwnProfile && (
            <Link to="/" className="analyze-new-btn">
              + Analyze New Song
            </Link>
          )}
        </div>

        {songs.length === 0 ? (
          <div className="no-songs">
            <span className="no-songs-emoji">🎵</span>
            <p>
              {isOwnProfile 
                ? "You haven't analyzed any songs yet!" 
                : "No public songs to display"}
            </p>
            {isOwnProfile && (
              <Link to="/" className="analyze-cta">
                Analyze your first song →
              </Link>
            )}
          </div>
        ) : (
          <div className="songs-grid">
            {songs.map(song => (
              <SongCard 
                key={song.id}
                song={song}
                showActions={isOwnProfile}
                onDelete={handleDeleteSong}
                onToggleVisibility={handleToggleVisibility}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;