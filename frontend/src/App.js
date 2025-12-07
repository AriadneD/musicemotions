// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SpotifyProvider } from './context/SpotifyContext';
import Navbar from './components/Navbar';
import Analyze from './pages/Analyze';
import SignIn from './pages/SignIn';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Explore from './pages/Explore';
import SongDetail from './pages/SongDetail';
import Spotify from './pages/Spotify';
import './App.css';


function App() {
  return (
    <SpotifyProvider>
      <AuthProvider>
        <Router>
          <div className="app">
            <div className="bg-gradient" />
            <div className="bg-noise" />
            <Navbar />
            <Routes>
              <Route path="/" element={<Analyze />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/song/:songId" element={<SongDetail />} />
              <Route path="/spotify" element={<Spotify />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </SpotifyProvider>
  );
}

export default App;