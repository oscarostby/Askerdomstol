import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, push, onValue, update, remove, get, serverTimestamp, off } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAOCEKvzROBDPubA6c5AUQ5dIXuvoeUlxY",
  authDomain: "askergui.firebaseapp.com",
  projectId: "askergui",
  storageBucket: "askergui.firebasestorage.app",
  messagingSenderId: "187274761862",
  appId: "1:187274761862:web:57fc23be3fef76c1852307",
  measurementId: "G-R1H8VNGZT3",
  databaseURL: "https://askergui-default-rtdb.europe-west1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Helper to ensure user is auth'd anonymously for DB access
export const ensureAuth = async () => {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return auth.currentUser;
  } catch (error) {
    console.warn("Firebase Auth failed (likely not enabled in console). Using mock fallback.", error);
    
    // Fallback: Generate a persistent mock ID for this session
    let mockUid = localStorage.getItem('asker_mock_uid');
    if (!mockUid) {
      mockUid = 'mock_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('asker_mock_uid', mockUid);
    }
    
    // Return an object that mimics the necessary parts of the User object
    return {
      uid: mockUid,
      isAnonymous: true
    };
  }
};