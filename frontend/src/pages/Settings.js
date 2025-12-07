// src/pages/Settings.js
import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

function Settings() {
  const { user, userProfile, updateUserProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    bio: ''
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        username: userProfile.username || '',
        bio: userProfile.bio || ''
      });
    }
  }, [userProfile]);

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate username (alphanumeric and underscores only)
      if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
      }

      await updateUserProfile({
        displayName: formData.displayName,
        username: formData.username.toLowerCase(),
        bio: formData.bio
      });

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="settings-page">
      <motion.div 
        className="settings-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>Settings</h1>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-section">
            <h2>Profile</h2>
            
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Your name"
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-prefix">
                <span>@</span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="username"
                  maxLength={30}
                />
              </div>
              <p className="form-hint">This is your public profile URL: wayve.app/profile/{formData.username || 'username'}</p>
            </div>

            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell us about your music taste..."
                rows={3}
                maxLength={160}
              />
              <p className="form-hint">{formData.bio.length}/160 characters</p>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">Profile updated successfully!</div>}

          <button 
            type="submit" 
            className="save-settings-btn"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div className="form-section danger-zone">
          <h2>Account</h2>
          <p>Email: {user.email}</p>
          <button 
            className="logout-btn"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default Settings;