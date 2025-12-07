// src/context/YouTubeContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const YouTubeContext = createContext();

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export function useYouTube() {
  return useContext(YouTubeContext);
}

export function YouTubeProvider({ children }) {
  const [ytToken, setYtToken] = useState(null);
  const [ytRefreshToken, setYtRefreshToken] = useState(null);
  const [ytUser, setYtUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check URL params for tokens on mount (OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('yt_token');
    const refresh = params.get('yt_refresh');
    const error = params.get('error');

    if (error) {
      console.error('YouTube auth error:', error);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (token) {
      setYtToken(token);
      localStorage.setItem('yt_token', token);
      if (refresh) {
        setYtRefreshToken(refresh);
        localStorage.setItem('yt_refresh_token', refresh);
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      const savedToken = localStorage.getItem('yt_token');
      const savedRefresh = localStorage.getItem('yt_refresh_token');
      if (savedToken) setYtToken(savedToken);
      if (savedRefresh) setYtRefreshToken(savedRefresh);
    }

    setLoading(false);
  }, []);

  // Fetch user when token changes
  useEffect(() => {
    if (ytToken) {
      fetchYouTubeUser();
    } else {
      setYtUser(null);
    }
  }, [ytToken]);

  const fetchYouTubeUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/youtube/me`, {
        headers: { 'Authorization': `Bearer ${ytToken}` }
      });

      if (response.status === 401) {
        await refreshToken();
        return;
      }

      if (response.ok) {
        const user = await response.json();
        setYtUser(user);
      }
    } catch (error) {
      console.error('Failed to fetch YouTube user:', error);
    }
  };

  const connectYouTube = async () => {
    try {
      const response = await fetch(`${API_URL}/api/youtube/login`);
      const data = await response.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (error) {
      console.error('Failed to start YouTube auth:', error);
    }
  };

  const refreshToken = async () => {
    if (!ytRefreshToken) {
      disconnectYouTube();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/youtube/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: ytRefreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        setYtToken(data.access_token);
        localStorage.setItem('yt_token', data.access_token);
      } else {
        disconnectYouTube();
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      disconnectYouTube();
    }
  };

  const disconnectYouTube = () => {
    setYtToken(null);
    setYtRefreshToken(null);
    setYtUser(null);
    localStorage.removeItem('yt_token');
    localStorage.removeItem('yt_refresh_token');
  };

  const ytFetch = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${ytToken}`
      }
    });

    if (response.status === 401) {
      await refreshToken();
      const newToken = localStorage.getItem('yt_token');
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
    ytToken,
    ytUser,
    loading,
    isConnected: !!ytToken,
    connectYouTube,
    disconnectYouTube,
    ytFetch
  };

  return (
    <YouTubeContext.Provider value={value}>
      {children}
    </YouTubeContext.Provider>
  );
}