import { useEffect, useState, useSyncExternalStore, createContext, useContext } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, getDocs, Timestamp, writeBatch
} from 'firebase/firestore';
import { db, onUser } from './firebase.js';

/*
 * Saved data lives in three collections:
 *   saves  – places, cafes, food spots, couple spots, wishlist
 *   trips  – itineraries (from a reel, generated, or custom)
 *   notes  – free-form notes
 * Logged in: Firestore at users/{uid}/{collection}. Guest: localStorage.
 * On first login, guest data is copied to the account.
 */

const LS = (name) => `wanderpin:${name}`;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function readLocal(name) {
  try { return JSON.parse(localStorage.getItem(LS(name)) || '[]'); } catch { return []; }
}
function writeLocal(name, items) {
  try { localStorage.setItem(LS(name), JSON.stringify(items)); } catch { /* storage full or blocked */ }
  emit();
}
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------- current user ---------- */
let currentUser = null;
let userReady = false;
const userListeners = new Set();
onUser(async (u) => {
  currentUser = u;
  userReady = true;
  if (u && db) await migrateLocal(u.uid);
  userListeners.forEach((l) => l());
});

export function useUser() {
  const user = useSyncExternalStore((l) => { userListeners.add(l); return () => userListeners.delete(l); }, () => currentUser);
  const ready = useSyncExternalStore((l) => { userListeners.add(l); return () => userListeners.delete(l); }, () => userReady);
  return { user, ready };
}

async function migrateLocal(uid) {
  const batch = writeBatch(db);
  let n = 0;
  for (const name of ['saves', 'trips', 'notes']) {
    for (const item of readLocal(name)) {
      batch.set(doc(db, 'users', uid, name, item.id), item);
      n++;
    }
  }
  if (!n) return;
  await batch.commit();
  ['saves', 'trips', 'notes'].forEach((name) => localStorage.removeItem(LS(name)));
}

/* ---------- collections ---------- */
export function useCollection(name) {
  const { user } = useUser();
  const [items, setItems] = useState(() => (user ? [] : readLocal(name)));
  useEffect(() => {
    if (user && db) {
      const q = query(collection(db, 'users', user.uid, name), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setItems([]));
    }
    const update = () => setItems(readLocal(name));
    update();
    listeners.add(update);
    return () => listeners.delete(update);
  }, [user, name]);
  return items;
}

export async function addItem(name, data) {
  const id = data.id || newId();
  const item = { ...data, id, createdAt: Date.now() };
  if (currentUser && db) await setDoc(doc(db, 'users', currentUser.uid, name, id), item);
  else writeLocal(name, [item, ...readLocal(name).filter((x) => x.id !== id)]);
  return id;
}

export async function updateItem(name, id, patch) {
  if (currentUser && db) return setDoc(doc(db, 'users', currentUser.uid, name, id), { ...patch, updatedAt: Date.now() }, { merge: true });
  writeLocal(name, readLocal(name).map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)));
}

export async function removeItem(name, id) {
  if (currentUser && db) return deleteDoc(doc(db, 'users', currentUser.uid, name, id));
  writeLocal(name, readLocal(name).filter((x) => x.id !== id));
}

/** Stable id for a saved place so the same spot isn't saved twice. */
export const saveKey = (p) => `${(p.type || 'place')}-${(p.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.lat ? p.lat.toFixed(3) : ''}`.slice(0, 120);

export function useSaved(place) {
  const saves = useCollection('saves');
  const key = saveKey(place);
  const saved = saves.some((s) => s.id === key);
  const toggle = () => (saved ? removeItem('saves', key) : addItem('saves', { ...place, id: key }));
  return [saved, toggle];
}

/* ---------- reports + crowd check (shared, need Firebase) ---------- */
export async function sendReport(report) {
  const data = { ...report, uid: currentUser?.uid || null, createdAt: db ? serverTimestamp() : Date.now() };
  if (db) return addDoc(collection(db, 'reports'), data);
  const local = readLocal('reports-queue');
  writeLocal('reports-queue', [...local, data]);
}

export async function sendCrowdReport(placeKey, level) {
  if (!db) return;
  return addDoc(collection(db, 'crowd'), { placeKey, level, createdAt: serverTimestamp() });
}

export async function recentCrowd(placeKey) {
  if (!db) return null;
  try {
    const since = Timestamp.fromMillis(Date.now() - 3 * 3600 * 1000);
    const snap = await getDocs(query(collection(db, 'crowd'), where('placeKey', '==', placeKey), where('createdAt', '>', since)));
    if (snap.empty) return null;
    const levels = snap.docs.map((d) => d.data().level);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    return { level: ['Quiet', 'Calm', 'Moderate', 'Busy'][Math.round(avg)], count: levels.length };
  } catch { return null; }
}

/* ---------- toast ---------- */
export const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);
