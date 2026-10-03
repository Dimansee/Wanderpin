import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { discoverKey, FRESH_DAYS, DISCOVER_VERSION } from './discoverConfig.js';
import { curatedFor } from './admin.js';

export { DISCOVER_CATS, REFRESH_DAYS, cellOf, discoverKey } from './discoverConfig.js';

const memo = new Map();

export const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

/**
 * AI picks for a category around a point.
 * Reads the shared copy from Firestore when this area was already searched; otherwise calls
 * /api/discover, which streams progress. `onEvent` receives {type:'step'|'sources', ...} as they arrive.
 */
export async function getDiscover(cat, lat, lon, opts = {}) {
  const [raw, curated] = await Promise.all([getDiscoverRaw(cat, lat, lon, opts), curatedFor(cat, lat, lon)]);
  if (!curated.length) return raw;
  const names = new Set(curated.map((c) => c.name.toLowerCase()));
  const ai = (raw.status === 'ok' ? raw.items : []).filter((i) => !names.has(i.name.toLowerCase()));
  return {
    ...(raw.status === 'ok' ? raw : { area: opts.place || curated[0].city, updatedAt: Date.now() }),
    status: 'ok',
    items: [...curated, ...ai]
  };
}

async function getDiscoverRaw(cat, lat, lon, { place, refresh, onEvent } = {}) {
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

/* ---------- "More nearby": every matching OpenStreetMap place in the visible map area ---------- */
import { osmQuery } from './discoverConfig.js';
const boxCache = new Map();
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function getAreaPlaces(cat, b) {
  // round the box so small pans reuse results
  const r = (v) => Math.round(v * 50) / 50;
  const box = `(${r(b.s)},${r(b.w)},${r(b.n)},${r(b.e)})`;
  const key = `${cat}${box}`;
  if (boxCache.has(key)) return boxCache.get(key);
  const q = osmQuery(cat, box, 300);
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!res.ok) continue;
      const d = await res.json();
      const seen = new Set();
      const out = [];
      for (const el of d.elements || []) {
        const t = el.tags || {};
        const name = t['name:en'] || t.name;
        const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
        if (!name || !Number.isFinite(lat) || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        out.push({
          id: `osm-${el.type}-${el.id}`, name, lat, lon,
          kind: (t.amenity || t.tourism || t.historic || t.leisure || t.shop || t.natural || '').replace(/_/g, ' '),
          cuisine: t.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '), hours: t.opening_hours, famous: !!(t.wikidata || t.wikipedia)
        });
      }
      boxCache.set(key, out);
      return out;
    } catch { /* next mirror */ }
  }
  throw new Error('Map places are busy, try again in a moment');
}

const GMAPS_QUERY = { food: 'street food', cafe: 'cafes', couple: 'romantic places', sight: 'tourist attractions', family: 'family restaurants', busy: 'markets', quiet: 'parks', stay: 'hotels' };
export const googleMapsSearch = (cat, lat, lon, zoom = 14) => `https://www.google.com/maps/search/${encodeURIComponent(GMAPS_QUERY[cat] || cat)}/@${(+lat).toFixed(5)},${(+lon).toFixed(5)},${zoom}z`;
