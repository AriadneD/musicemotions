// src/firebase/songs.js
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { db } from './config';

// Save a new song analysis
export async function saveSongAnalysis(userId, songData) {
  try {
    const songsRef = collection(db, 'songs');
    const docRef = await addDoc(songsRef, {
      userId,
      url: songData.url,
      metadata: songData.metadata,
      profile: songData.profile,
      timeSeries: songData.timeSeries,
      context: songData.context,
      isPublic: true,
      createdAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving song:', error);
    throw error;
  }
}

// Get all songs for a user
export async function getUserSongs(userId) {
  try {
    const songsRef = collection(db, 'songs');
    // Try with ordering first
    try {
      const q = query(
        songsRef, 
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (indexError) {
      // If index doesn't exist, fall back to unordered query
      console.warn('Index not ready, using unordered query:', indexError.message);
      const q = query(songsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  } catch (error) {
    console.error('Error fetching user songs:', error);
    throw error;
  }
}

// Get public songs for a user (for public profile view)
export async function getPublicUserSongs(userId) {
  try {
    const songsRef = collection(db, 'songs');
    // Try with full query first
    try {
      const q = query(
        songsRef, 
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (indexError) {
      // Fall back to simpler query
      console.warn('Index not ready, using simpler query:', indexError.message);
      const q = query(
        songsRef, 
        where('userId', '==', userId),
        where('isPublic', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  } catch (error) {
    console.error('Error fetching public songs:', error);
    throw error;
  }
}

// Get a single song by ID
export async function getSongById(songId) {
  try {
    const songRef = doc(db, 'songs', songId);
    const songSnap = await getDoc(songRef);
    
    if (songSnap.exists()) {
      return { id: songSnap.id, ...songSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching song:', error);
    throw error;
  }
}

// Update song visibility
export async function updateSongVisibility(songId, isPublic) {
  try {
    const songRef = doc(db, 'songs', songId);
    await updateDoc(songRef, { isPublic });
  } catch (error) {
    console.error('Error updating song visibility:', error);
    throw error;
  }
}

// Delete a song
export async function deleteSong(songId) {
  try {
    const songRef = doc(db, 'songs', songId);
    await deleteDoc(songRef);
  } catch (error) {
    console.error('Error deleting song:', error);
    throw error;
  }
}

// Get recent public songs (for explore/discover page)
export async function getRecentPublicSongs(limitCount = 20) {
  try {
    const songsRef = collection(db, 'songs');
    try {
      const q = query(
        songsRef,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (indexError) {
      console.warn('Index not ready for recent songs:', indexError.message);
      const q = query(
        songsRef,
        where('isPublic', '==', true),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  } catch (error) {
    console.error('Error fetching recent songs:', error);
    throw error;
  }
}

// Get user by username (for public profile URLs)
export async function getUserByUsername(username) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return null;
  }
}

// Get user by ID
export async function getUserById(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}