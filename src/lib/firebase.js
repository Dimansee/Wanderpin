import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
