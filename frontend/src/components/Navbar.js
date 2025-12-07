// src/components/Navbar.js
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

function Navbar() {
  const { user, userProfile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-emoji">🎶</span>
          <span className="logo-text">Muse</span>
        </Link>

        <div className="navbar-links">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Analyze
          </Link>
          <Link 
            to="/explore" 
            className={`nav-link ${location.pathname === '/explore' ? 'active' : ''}`}
          >
            Explore
          </Link>

          {/*
          <Link to="/spotify">Spotify</Link>
          */}
        </div>

        <div className="navbar-auth">
          {user ? (
            <div className="user-menu">
              <button 
                className="user-button"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <img 
                  src={user.photoURL || '/default-avatar.png'} 
                  alt="Profile" 
                  className="user-avatar"
                />
                <span className="user-name">{userProfile?.displayName || user.displayName}</span>
                <span className="dropdown-arrow">▾</span>
              </button>
              
              <AnimatePresence>
                {showDropdown && (
                  <motion.div 
                    className="dropdown-menu"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Link 
                      to={`/profile/${userProfile?.username || user.uid}`}
                      className="dropdown-item"
                      onClick={() => setShowDropdown(false)}
                    >
                      👤 My Profile
                    </Link>
                    <Link 
                      to="/settings"
                      className="dropdown-item"
                      onClick={() => setShowDropdown(false)}
                    >
                      ⚙️ Settings
                    </Link>
                    <div className="dropdown-divider" />
                    <button 
                      className="dropdown-item logout"
                      onClick={handleLogout}
                    >
                      🚪 Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link to="/signin" className="signin-button">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;