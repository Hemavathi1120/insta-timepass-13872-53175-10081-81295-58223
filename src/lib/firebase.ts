import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDF0Ps_QBUcHcs6ghEOd3H_3iEp6e3hLn4",
  authDomain: "timepass-df191.firebaseapp.com",
  projectId: "timepass-df191",
  storageBucket: "timepass-df191.firebasestorage.app",
  messagingSenderId: "964801554979",
  appId: "1:964801554979:web:7a03f096f7801a7f9c5f96",
  measurementId: "G-H79JBSFC9X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize analytics only in browser environment
if (typeof window !== 'undefined') {
  getAnalytics(app);
}
