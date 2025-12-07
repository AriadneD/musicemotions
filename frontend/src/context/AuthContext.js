// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ensure user document exists in Firestore
  async function ensureUserDocument(firebaseUser) {
    if (!firebaseUser) return null;
    
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user profile
        const newUserData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Anonymous',
          photoURL: firebaseUser.photoURL || null,
          username: firebaseUser.email?.split('@')[0] || firebaseUser.uid.slice(0, 8),
          bio: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userRef, newUserData);
        console.log('Created new user document:', firebaseUser.uid);
        return { id: firebaseUser.uid, ...newUserData };
      } else {
        return { id: userSnap.id, ...userSnap.data() };
      }
    } catch (error) {
      console.error('Error ensuring user document:', error);
      // Return a fallback profile from Firebase Auth data
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || 'Anonymous',
        photoURL: firebaseUser.photoURL,
        username: firebaseUser.email?.split('@')[0] || firebaseUser.uid.slice(0, 8),
        bio: ''
      };
    }
  }

  async function signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // Ensure user document exists and get profile
      const profile = await ensureUserDocument(firebaseUser);
      setUserProfile(profile);
      
      return firebaseUser;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async function fetchUserProfile(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const profile = { id: userSnap.id, ...userSnap.data() };
        setUserProfile(profile);
        return profile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  async function updateUserProfile(updates) {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Refresh profile
      await fetchUserProfile(user.uid);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Ensure user document exists and fetch profile
        const profile = await ensureUserDocument(firebaseUser);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    userProfile,
    loading,
    signInWithGoogle,
    logout,
    updateUserProfile,
    fetchUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}