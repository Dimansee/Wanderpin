// Vercel serverless function: AI picks for a category in a ~20 km area, shared by all users.
// POST { cat, lat, lon, place?, refresh? }
// 1. If Firestore already has fresh picks for this category + area, return them.
// 2. Otherwise: get real places from OpenStreetMap, let Gemini choose and describe the best ones
//    (plus a few famous ones OSM missed, each verified on the map), save to Firestore, return.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DISCOVER_CATS, FRESH_DAYS, REFRESH_DAYS, cellOf, discoverKey } from '../src/lib/discoverConfig.js';

const UA = 'Wanderpin/1.0 (https://wanderpin-lovat.vercel.app)';
const DAY = 86400000;
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

function adminDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    if (!getApps().length) {
      const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      initializeApp({ credential: cert(JSON.parse(json)) });
    }
    return getFirestore();
  } catch (e) {
    console.error('Firebase admin init failed', e.message);
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJSON(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function overpassQuery(cat, lat, lon, r) {
  const A = `(around:${r},${lat},${lon})`;
  const parts = {
    food: [`nwr${A}[amenity~"^(fast_food|food_court|ice_cream)$"][name]`, `nwr${A}[shop~"^(confectionery|pastry|bakery|deli)$"][name]`, `nwr${A}[amenity=restaurant][name][cuisine]`],
    cafe: [`nwr${A}[amenity=cafe][name]`],
    couple: [`nwr${A}[tourism=viewpoint]`, `nwr${A}[leisure~"^(park|garden)$"][name]`, `nwr${A}[natural~"^(beach|water)$"][name]`, `nwr${A}[tourism=attraction][name]`],
    sight: [`nwr${A}[tourism~"^(attraction|museum|gallery|zoo|theme_park)$"][name]`, `nwr${A}[historic~"^(monument|castle|fort|palace|memorial|ruins|archaeological_site|city_gate)$"][name]`, `nwr${A}[amenity=place_of_worship][name][wikidata]`],
    family: [`nwr${A}[amenity=restaurant][name]`],
    busy: [`nwr${A}[amenity=marketplace][name]`, `nwr${A}[shop=mall][name]`, `nwr${A}[tourism=attraction][name][wikidata]`, `nwr${A}[place=square][name]`],
    quiet: [`nwr${A}[leisure~"^(park|garden|nature_reserve)$"][name]`, `nwr${A}[tourism=viewpoint]`, `nwr${A}[natural~"^(water|wood)$"][name]`],
    stay: [`nwr${A}[tourism~"^(hotel|guest_house|hostel|resort)$"][name]`]
  }[cat];
  return `[out:json][timeout:25];(${parts.join(';')};);out center tags 350;`;
}

async function osmCandidates(cat, lat, lon) {
  const q = overpassQuery(cat, lat, lon, 11000);
  for (const url of OVERPASS) {
    try {
      const d = await fetchJSON(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 28000);
      const seen = new Set();
      const out = [];
      for (const el of d.elements || []) {
        const t = el.tags || {};
        const name = t['name:en'] || t.name;
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        out.push({
          name,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
          kind: (t.amenity || t.tourism || t.historic || t.leisure || t.shop || t.natural || '').replace(/_/g, ' '),
          cuisine: t.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '),
          famous: !!(t.wikidata || t.wikipedia),
          hours: t.opening_hours
        });
      }
      // Famous ones first, then those with more detail
      out.sort((a, b) => (b.famous - a.famous) || ((b.cuisine ? 1 : 0) - (a.cuisine ? 1 : 0)));
      return out;
    } catch { /* try the next mirror */ }
  }
  return [];
}

async function areaName(lat, lon) {
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10`, {}, 8000);
    const a = r.address || {};
    return a.city || a.town || a.county || a.state_district || a.state || 'this area';
  } catch { return 'this area'; }
}

async function askGemini(cat, area, candidates) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const list = candidates.slice(0, 160).map((c, i) => `${i}|${c.name}|${c.kind}${c.cuisine ? ' (' + c.cuisine + ')' : ''}${c.famous ? '|famous' : ''}`).join('\n');
  const prompt = `You are a local travel expert for ${area}.
A traveller wants: ${DISCOVER_CATS[cat].ai}.
Below are real places from OpenStreetMap near ${area} (format: index|name|type|flags).
Return ONLY JSON:
{"picks":[{"i":number,"why":string,"bestTime":string,"tags":[string]}],
 "extras":[{"name":string,"why":string,"bestTime":string,"tags":[string]}]}
Rules:
- "picks": choose the 10 to 18 best places for this request from the list, best first. Use the index "i" from the list.
- "extras": up to 6 genuinely famous, well-known places in ${area} for this request that are MISSING from the list. Only include places you are sure exist in ${area}. If unsure, leave it empty.
- "why": one short, specific line (what to try/see, vibe, price level). No generic praise.
- "bestTime": short, e.g. "Evenings", "Before 10 am", "Sunset", "Lunch".
- "tags": 1 to 3 short tags, e.g. "Budget", "Iconic", "Rooftop", "Veg", "Late night".
- Skip chains and anything clearly unrelated to the request.

Places:
${list || '(none found)'}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } })
  });
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  const data = await r.json();
  const txt = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '{}';
  return JSON.parse(txt.replace(/^```json|```$/g, '').trim());
}

// Check an AI-suggested place really exists near the area before showing it
async function verifyOnMap(name, area, center) {
  const d = 0.3;
  const vb = `${center.lon - d},${center.lat + d},${center.lon + d},${center.lat - d}`;
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${name}, ${area}`)}&format=jsonv2&limit=1&viewbox=${vb}&bounded=1`, {}, 8000);
    if (r[0]) return { lat: +r[0].lat, lon: +r[0].lon };
  } catch { /* ignore */ }
  return null;
}

async function generate(cat, center, place) {
  const [candidates, area] = await Promise.all([osmCandidates(cat, center.lat, center.lon), place ? Promise.resolve(place) : areaName(center.lat, center.lon)]);
  let ai = null;
  try { ai = await askGemini(cat, area, candidates); } catch (e) { console.error(e.message); }

  let items = [];
  if (ai?.picks?.length) {
    items = ai.picks
      .filter((p) => candidates[p.i])
      .map((p) => ({ ...candidates[p.i], why: p.why || '', bestTime: p.bestTime || '', tags: (p.tags || []).slice(0, 3), source: 'osm' }));
    for (const x of (ai.extras || []).slice(0, 6)) {
      if (!x?.name || items.some((i) => i.name.toLowerCase() === x.name.toLowerCase())) continue;
      await sleep(1100); // Nominatim allows ~1 request per second
      const pos = await verifyOnMap(x.name, area, center);
      if (pos) items.push({ name: x.name, ...pos, kind: '', why: x.why || '', bestTime: x.bestTime || '', tags: (x.tags || []).slice(0, 3), source: 'ai' });
    }
  } else {
    // No AI available: best-known places from OpenStreetMap
    items = candidates.slice(0, 15).map((c) => ({ ...c, why: [c.kind, c.cuisine].filter(Boolean).join(' · '), bestTime: '', tags: c.famous ? ['Popular'] : [], source: 'osm' }));
  }
  items = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon)).map((i, n) => ({ id: `${n}-${i.name}`.slice(0, 80), ...i }));
  return { area, items, ai: !!ai?.picks?.length };
}

const clean = (o) => JSON.parse(JSON.stringify(o)); // drop undefined for Firestore

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Use POST' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const cat = String(body.cat || '');
    const lat = Number(body.lat), lon = Number(body.lon);
    if (!DISCOVER_CATS[cat] || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
      return res.status(400).json({ status: 'error', message: 'Bad request' });
    }
    const place = typeof body.place === 'string' ? body.place.slice(0, 80) : '';
    const key = discoverKey(cat, lat, lon);
    const { center } = cellOf(lat, lon);
    const db = adminDb();
    const ref = db?.collection('discover').doc(key);

    if (ref) {
      const snap = await ref.get();
      if (snap.exists) {
        const d = snap.data();
        const age = Date.now() - (d.updatedAt || 0);
        const wantsRefresh = body.refresh && age > REFRESH_DAYS * DAY;
        if (age < FRESH_DAYS * DAY && !wantsRefresh && d.items?.length) {
          ref.update({ searches: FieldValue.increment(1) }).catch(() => {});
          return res.status(200).json({ status: 'ok', cached: true, key, ...d, searches: (d.searches || 0) + 1 });
        }
      }
    }

    const result = await generate(cat, center, place);
    if (!result.items.length) return res.status(200).json({ status: 'empty', key, area: result.area });

    const doc = clean({ cat, key, center, area: result.area, items: result.items, ai: result.ai, updatedAt: Date.now() });
    if (ref) {
      await ref.set({ ...doc, searches: FieldValue.increment(1) }, { merge: true });
    }
    return res.status(200).json({ status: 'ok', cached: false, saved: !!ref, key, ...doc, searches: 1 });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ status: 'error', message: 'Could not find places right now. Try again in a minute.' });
  }
}
