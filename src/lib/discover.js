import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { discoverKey, FRESH_DAYS, DISCOVER_VERSION } from './discoverConfig.js';

export { DISCOVER_CATS, REFRESH_DAYS, cellOf, discoverKey } from './discoverConfig.js';

const memo = new Map();

export const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/**
 * AI picks for a category around a point.
 * Reads the shared copy from Firestore when this area was already searched; otherwise calls
 * /api/discover, which streams progress. `onEvent` receives {type:'step'|'sources', ...} as they arrive.
 */
export async function getDiscover(cat, lat, lon, { place, refresh, onEvent } = {}) {
  const key = discoverKey(cat, lat, lon);
  if (!refresh && memo.has(key)) return memo.get(key);

  if (!refresh && db) {
    try {
      const snap = await getDoc(doc(db, 'discover', key));
      if (snap.exists()) {
        const d = snap.data();
        if (d.v === DISCOVER_VERSION && Date.now() - (d.updatedAt || 0) < FRESH_DAYS * 86400000 && d.items?.length) {
          const out = { status: 'ok', cached: true, ...d };
          memo.set(key, out);
          return out;
        }
      }
    } catch { /* fall through to the API */ }
  }

  let res;
  try {
    res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat, lat, lon, place, refresh: !!refresh })
    });
  } catch {
    return { status: 'error', message: 'Could not reach Wanderpin. Check your connection.' };
  }

  let result = null;
  const handle = (line) => {
    if (!line.trim()) return;
    let ev;
    try { ev = JSON.parse(line); } catch { return; }
    if (ev.type === 'result') result = ev.data;
    else if (ev.type === 'error') result = { status: 'error', message: ev.message };
    else onEvent?.(ev);
  };

  if (res.body?.getReader) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    }
    handle(buf);
  } else {
    (await res.text()).split('\n').forEach(handle);
  }

  result = result || { status: 'error', message: 'Something went wrong. Try again.' };
  if (result.status === 'ok') memo.set(key, result);
  return result;
}

export function ageLabel(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'updated today';
  if (days === 1) return 'updated yesterday';
  return `updated ${days} days ago`;
}
