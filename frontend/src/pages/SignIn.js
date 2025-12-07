// src/pages/SignIn.js
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './SignIn.css';

function SignIn() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already signed in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (error) {
      console.error('Sign in error:', error);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <motion.div 
        className="signin-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="signin-header">
          <span className="signin-emoji">🎶</span>
          <h1>Welcome to Wayve</h1>
          <p>Sign in to save your music analyses and build your emotional profile</p>
        </div>

        {error && (
          <div className="signin-error">
            {error}
          </div>
        )}

        <div className="signin-buttons">
          <button 
            className="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>

        <div className="signin-features">
          <div className="feature">
            <span className="feature-icon">💾</span>
            <span>Save your analyses</span>
          </div>
          <div className="feature">
            <span className="feature-icon">👤</span>
            <span>Build a public profile</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <span>Track your music taste</span>
          </div>
        </div>

        <p className="signin-terms">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </motion.div>
    </div>
  );
}

export default SignIn;