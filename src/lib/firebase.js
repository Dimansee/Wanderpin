import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile
} from 'firebase/auth';
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

/* ---------- Email + password ---------- */
const AUTH_ERRORS = {
  'auth/invalid-email': 'That email address looks wrong.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': 'Use at least 6 characters for your password.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account with this email. Create one instead.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'Email login is not switched on yet in Firebase (Authentication → Sign-in method → Email/Password).',
  'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
  'auth/unauthorized-domain': 'This website is not yet allowed in Firebase (Authentication → Settings → Authorized domains).'
};
export const authMessage = (e) => AUTH_ERRORS[e?.code] || e?.message || 'Something went wrong. Try again.';

export async function signUpWithEmail(name, email, password) {
  if (!auth) throw new Error('Login is not set up yet.');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() });
  return cred;
}

export function signInWithEmail(email, password) {
  if (!auth) throw new Error('Login is not set up yet.');
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function resetPassword(email) {
  if (!auth) throw new Error('Login is not set up yet.');
  return sendPasswordResetEmail(auth, email.trim());
}

export function onUser(cb) {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}
