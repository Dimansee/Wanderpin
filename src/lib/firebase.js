import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web config is public by design (it ships in the app); the Firestore rules protect the data.
// Env vars override these defaults if set.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBKGjgjRvX7wxFsHUoxbhS6F7SSOvtz3wI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'wanderpin-ac2b4.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'wanderpin-ac2b4',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:642030776109:web:a8e1abeb0938f20b06ada4'
};

// The app still works without Firebase: everything is saved on the device.
export const firebaseReady = Boolean(config.apiKey && config.projectId);

export const app = firebaseReady ? initializeApp(config) : null;
export const auth = firebaseReady ? getAuth(app) : null;
export const db = firebaseReady ? getFirestore(app) : null;

export async function signInWithGoogle() {
  if (!auth) throw new Error('Login is not set up yet (add Firebase keys).');
  const provider = new GoogleAuthProvider();
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  // Popups are often blocked inside installed apps; redirect works there.
  return standalone ? signInWithRedirect(auth, provider) : signInWithPopup(auth, provider);
}

export function logOut() {
  return auth ? signOut(auth) : Promise.resolve();
}

export function onUser(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}
