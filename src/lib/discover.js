import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { discoverKey, FRESH_DAYS } from './discoverConfig.js';

export { DISCOVER_CATS, REFRESH_DAYS, cellOf, discoverKey } from './discoverConfig.js';

const memo = new Map();

/**
 * AI picks for a category around a point. Reads the shared copy straight from Firestore
 * when someone already searched this area; otherwise asks /api/discover to build and save it.
 */
export async function getDiscover(cat, lat, lon, { place, refresh } = {}) {
  const key = discoverKey(cat, lat, lon);
  if (!refresh && memo.has(key)) return memo.get(key);

  if (!refresh && db) {
    try {
      const snap = await getDoc(doc(db, 'discover', key));
      if (snap.exists()) {
        const d = snap.data();
        if (Date.now() - (d.updatedAt || 0) < FRESH_DAYS * 86400000 && d.items?.length) {
          const out = { status: 'ok', cached: true, ...d };
          memo.set(key, out);
          return out;
        }
      }
    } catch { /* fall through to the API */ }
  }

  const r = await fetch('/api/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat, lat, lon, place, refresh: !!refresh })
  });
  const data = await r.json().catch(() => ({ status: 'error', message: 'Could not reach Wanderpin.' }));
  if (data.status === 'ok') memo.set(key, data);
  return data;
}

export function ageLabel(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'updated today';
  if (days === 1) return 'updated yesterday';
  return `updated ${days} days ago`;
}
