// src/context/SpotifyContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const SpotifyContext = createContext();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export function useSpotify() {
  return useContext(SpotifyContext);
}

export function SpotifyProvider({ children }) {
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState(null);
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check URL params for tokens on mount (OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('spotify_token');
    const refresh = params.get('spotify_refresh');
    const error = params.get('spotify_error');

    if (error) {
      console.error('Spotify auth error:', error);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (token) {
      setSpotifyToken(token);
      localStorage.setItem('spotify_token', token);
      if (refresh) {
        setSpotifyRefreshToken(refresh);
        localStorage.setItem('spotify_refresh_token', refresh);
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // Try to restore from localStorage
      const savedToken = localStorage.getItem('spotify_token');
      const savedRefresh = localStorage.getItem('spotify_refresh_token');
      if (savedToken) setSpotifyToken(savedToken);
      if (savedRefresh) setSpotifyRefreshToken(savedRefresh);
    }

    setLoading(false);
  }, []);

  // Fetch user profile when token changes
  useEffect(() => {
    if (spotifyToken) {
      fetchSpotifyUser();
    } else {
      setSpotifyUser(null);
    }
  }, [spotifyToken]);

  const fetchSpotifyUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/spotify/me`, {
        headers: { 'Authorization': `Bearer ${spotifyToken}` }
      });

      if (response.status === 401) {
        // Token expired, try refresh
        await refreshToken();
        return;
      }

      if (response.ok) {
        const user = await response.json();
        setSpotifyUser(user);
      }
    } catch (error) {
      console.error('Failed to fetch Spotify user:', error);
    }
  };

  const connectSpotify = async () => {
    try {
      const response = await fetch(`${API_URL}/api/spotify/login`);
      const data = await response.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (error) {
      console.error('Failed to start Spotify auth:', error);
    }
  };

  const refreshToken = async () => {
    if (!spotifyRefreshToken) {
      disconnectSpotify();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/spotify/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: spotifyRefreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        setSpotifyToken(data.access_token);
        localStorage.setItem('spotify_token', data.access_token);
        if (data.refresh_token) {
          setSpotifyRefreshToken(data.refresh_token);
          localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }
      } else {
        disconnectSpotify();
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      disconnectSpotify();
    }
  };

  const disconnectSpotify = () => {
    setSpotifyToken(null);
    setSpotifyRefreshToken(null);
    setSpotifyUser(null);
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_refresh_token');
  };

  // API helpers with auto-retry on 401
  const spotifyFetch = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${spotifyToken}`
      }
    });

    if (response.status === 401) {
      await refreshToken();
      // Retry with new token
      const newToken = localStorage.getItem('spotify_token');
      if (newToken) {
        return fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
      }
    }

    return response;
  };

  const value = {
    spotifyToken,
    spotifyUser,
    loading,
    isConnected: !!spotifyToken,
    connectSpotify,
    disconnectSpotify,
    spotifyFetch
  };

  return (
    <SpotifyContext.Provider value={value}>
      {children}
    </SpotifyContext.Provider>
  );
}