import { useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc, query, where, orderBy, limit
} from 'firebase/firestore';
import { db } from './firebase.js';
import { useUser } from './store.js';
import { discoverKey } from './discoverConfig.js';

/** { loading, isAdmin } for the signed-in user (admins/{uid} exists). */
export function useAdmin() {
  const { user, ready } = useUser();
  const [state, setState] = useState({ loading: true, isAdmin: false });
  useEffect(() => {
    if (!ready) return;
    if (!user || !db) { setState({ loading: false, isAdmin: false }); return; }
    let alive = true;
    getDoc(doc(db, 'admins', user.uid))
      .then((s) => alive && setState({ loading: false, isAdmin: s.exists() }))
      .catch(() => alive && setState({ loading: false, isAdmin: false }));
    return () => { alive = false; };
  }, [user, ready]);
  return { ...state, user };
}

/* ---------- curated places ---------- */

export async function listPlaces({ cat, city } = {}) {
  const snap = await getDocs(query(collection(db, 'places'), orderBy('updatedAt', 'desc'), limit(500)));
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (cat) rows = rows.filter((r) => r.cat === cat);
  if (city) rows = rows.filter((r) => (r.city || '').toLowerCase().includes(city.toLowerCase()));
  return rows;
}

export async function savePlace(place, uid) {
  const data = {
    name: place.name.trim(),
    cat: place.cat,
    city: (place.city || '').trim(),
    lat: +(+place.lat).toFixed(6),
    lon: +(+place.lon).toFixed(6),
    why: (place.why || '').trim(),
    bestTime: (place.bestTime || '').trim(),
    tags: (place.tags || []).map((t) => t.trim()).filter(Boolean).slice(0, 5),
    price: place.price || '',
    link: (place.link || '').trim(),
    photo: (place.photo || '').trim(),
    trusted: place.trusted !== false,
    cellKey: discoverKey(place.cat, +place.lat, +place.lon),
    updatedAt: Date.now(),
    updatedBy: uid
  };
  if (place.id) { await setDoc(doc(db, 'places', place.id), data, { merge: true }); return place.id; }
  const ref = await addDoc(collection(db, 'places'), { ...data, createdAt: Date.now() });
  return ref.id;
}

export const deletePlace = (id) => deleteDoc(doc(db, 'places', id));

/** Places you added for this category in this area (shown to everyone). */
export async function curatedFor(cat, lat, lon) {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'places'), where('cellKey', '==', discoverKey(cat, lat, lon))));
    return snap.docs.map((d) => ({ id: `wp-${d.id}`, ...d.data(), curated: true, trusted: d.data().trusted !== false }));
  } catch { return []; }
}

/* ---------- reports ---------- */

export async function listReports() {
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const deleteReport = (id) => deleteDoc(doc(db, 'reports', id));

/* ---------- AI picks (discover cache) ---------- */

export async function listDiscover() {
  const snap = await getDocs(query(collection(db, 'discover'), orderBy('updatedAt', 'desc'), limit(60)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const updateDiscoverItems = (id, items) => updateDoc(doc(db, 'discover', id), { items, editedAt: Date.now() });
export const deleteDiscover = (id) => deleteDoc(doc(db, 'discover', id));
