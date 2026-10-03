// Vercel serverless function: AI picks for a category in a ~20 km area, shared by all users.
// POST { cat, lat, lon, place?, refresh? }
//
// Streams newline-delimited JSON so the app can show progress and the real sources live:
//   {"type":"step","id":"map","status":"start"|"done","count"?}
//   {"type":"sources","sources":[{domain,title,url}]}
//   {"type":"result","data":{...}}   (final)
//   {"type":"error","message":"..."}
//
// Pipeline: cached copy in Firestore → else OpenStreetMap places + Gemini with Google Search
// (blogs, Instagram, travel/review sites) → place each pick on the map → trust score → save.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DISCOVER_CATS, DISCOVER_VERSION, FRESH_DAYS, REFRESH_DAYS, cellOf, discoverKey, osmQuery } from '../src/lib/discoverConfig.js';

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
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchJSON(url, opts = {}, ms = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---------------- OpenStreetMap ---------------- */

function overpassQuery(cat, lat, lon, r) {
  return osmQuery(cat, `(around:${r},${lat},${lon})`);
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
        if (!name || seen.has(norm(name))) continue;
        seen.add(norm(name));
        out.push({
          name,
          alt: t.name !== name ? t.name : undefined,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
          kind: (t.amenity || t.tourism || t.historic || t.leisure || t.shop || t.natural || '').replace(/_/g, ' '),
          cuisine: t.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '),
          famous: !!(t.wikidata || t.wikipedia)
        });
      }
      out.sort((a, b) => (b.famous - a.famous) || ((b.cuisine ? 1 : 0) - (a.cuisine ? 1 : 0)));
      return out;
    } catch { /* try the next mirror */ }
  }
  return [];
}

// Match an AI-named place to an OSM place by name
function matchOsm(name, candidates) {
  const n = norm(name);
  if (!n) return null;
  let best = null;
  for (const c of candidates) {
    const a = norm(c.name), b = norm(c.alt);
    if (a === n || b === n) return c;
    if ((a && (a.includes(n) || n.includes(a)) && Math.min(a.length, n.length) >= 5) || (b && (b.includes(n) || n.includes(b)) && Math.min(b.length, n.length) >= 5)) best = best || c;
  }
  return best;
}

async function areaName(lat, lon) {
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10`, {}, 8000);
    const a = r.address || {};
    return a.city || a.town || a.county || a.state_district || a.state || 'this area';
  } catch { return 'this area'; }
}

const distKm = (a, b) => {
  const R = 6371, dA = ((b.lat - a.lat) * Math.PI) / 180, dO = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dA / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// Photon (OpenStreetMap search by Komoot): fast, biased to the area
async function locatePhoton(name, center) {
  try {
    const r = await fetchJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(name)}&lat=${center.lat}&lon=${center.lon}&limit=3`, {}, 7000);
    for (const f of r.features || []) {
      const [lon, lat] = f.geometry?.coordinates || [];
      if (Number.isFinite(lat) && distKm(center, { lat, lon }) < 25) return { lat, lon };
    }
  } catch { /* ignore */ }
  return null;
}

async function locate(name, area, center) {
  const d = 0.3;
  const vb = `${center.lon - d},${center.lat + d},${center.lon + d},${center.lat - d}`;
  try {
    const r = await fetchJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${name}, ${area}`)}&format=jsonv2&limit=1&viewbox=${vb}&bounded=1`, {}, 8000);
    if (r[0]) return { lat: +r[0].lat, lon: +r[0].lon };
  } catch { /* ignore */ }
  return null;
}

/* ---------------- Gemini ---------------- */

const domainOf = (title, uri) => {
  const t = (title || '').trim().toLowerCase();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(t)) return t.replace(/^www\./, '');
  try { return new URL(uri).hostname.replace(/^www\./, ''); } catch { return t || 'web'; }
};

function parseJSONFromText(txt) {
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

function buildPrompt(cat, area, candidates, grounded) {
  const list = candidates.slice(0, 120).map((c) => `${c.name}${c.cuisine ? ' (' + c.cuisine + ')' : ''}`).join('; ');
  return `You are a local travel expert for ${area}.
A traveller wants: ${DISCOVER_CATS[cat].ai}.
${grounded ? `Search the web for what travellers, food and travel bloggers, Instagram creators, review sites and local guides recommend in ${area} right now.` : ''}
Pick the 18 to 25 best real places in or very near ${area} for this request, best first.
For reference, places listed on OpenStreetMap near ${area}: ${list || '(none)'}.
Prefer the exact names people use. Never invent places. Skip big chains unless they are iconic locally.

Return ONLY a JSON object in a \`\`\`json code block, in this shape:
{"places":[{"name":string,"why":string,"bestTime":string,"tags":[string]}]}
- "why": one specific line (what to try or see, vibe, price level). No generic praise.
- "bestTime": short, e.g. "Evenings", "Before 10 am", "Sunset", "Lunch".
- "tags": 1 to 3 short tags, e.g. "Iconic", "Budget", "Rooftop", "Veg", "Late night".`;
}

async function callGemini(prompt, { grounded }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } };
  if (grounded) body.tools = [{ google_search: {} }];
  else body.generationConfig.responseMimeType = 'application/json';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const cand = data?.candidates?.[0] || {};
  const text = cand.content?.parts?.map((p) => p.text || '').join('') || '';
  return { text, meta: cand.groundingMetadata || null };
}

// Sources and, for each source, which text it supports
function readGrounding(meta) {
  if (!meta) return { sources: [], supports: [], entryPoint: '' };
  const sources = (meta.groundingChunks || []).map((c) => c.web).filter(Boolean)
    .map((w) => ({ domain: domainOf(w.title, w.uri), title: w.title || '', url: w.uri || '' }));
  const supports = (meta.groundingSupports || []).map((s) => ({ text: norm(s.segment?.text || ''), idx: s.groundingChunkIndices || [] }));
  return { sources, supports, entryPoint: meta.searchEntryPoint?.renderedContent || '' };
}

/* ---------------- Main pipeline ---------------- */

async function generate(cat, center, place, send) {
  send({ type: 'step', id: 'map', status: 'start' });
  const [candidates, area] = await Promise.all([osmCandidates(cat, center.lat, center.lon), place ? Promise.resolve(place) : areaName(center.lat, center.lon)]);
  send({ type: 'step', id: 'map', status: 'done', count: candidates.length });

  send({ type: 'step', id: 'web', status: 'start' });
  let picks = null, grounding = { sources: [], supports: [], entryPoint: '' }, mode = 'none';
  try {
    const g = await callGemini(buildPrompt(cat, area, candidates, true), { grounded: true });
    if (g) { picks = parseJSONFromText(g.text).places; grounding = readGrounding(g.meta); mode = 'web'; }
  } catch (e) { console.error('grounded call failed:', e.message); }
  if (!picks?.length) {
    try {
      const g = await callGemini(buildPrompt(cat, area, candidates, false), { grounded: false });
      if (g) { picks = parseJSONFromText(g.text).places; mode = 'ai'; }
    } catch (e) { console.error('plain call failed:', e.message); }
  }
  // de-duplicate sources by domain for display
  const byDomain = new Map();
  grounding.sources.forEach((s, i) => { if (!byDomain.has(s.domain)) byDomain.set(s.domain, { ...s, idx: [] }); byDomain.get(s.domain).idx.push(i); });
  const sourceList = [...byDomain.values()].map(({ idx, ...s }) => s);
  send({ type: 'sources', sources: sourceList });
  send({ type: 'step', id: 'web', status: 'done', count: sourceList.length });

  send({ type: 'step', id: 'verify', status: 'start' });
  let items = [];
  if (picks?.length) {
    const list = picks.filter((p) => p?.name).slice(0, 25).map((p) => ({ p, osm: matchOsm(p.name, candidates) }));
    // Place the ones OSM didn't match: Photon in parallel, then a few Nominatim tries
    await Promise.all(list.filter((x) => !x.osm).map(async (x) => { x.pos = await locatePhoton(x.p.name, center); }));
    let tries = 0;
    for (const x of list) {
      if (x.osm || x.pos || tries >= 5) continue;
      tries++; await sleep(1100);
      x.pos = await locate(x.p.name, area, center);
    }
    for (const { p, osm, pos: found } of list) {
      // Which web sources back this place?
      const n = norm(p.name);
      const key = n.split(' ').slice(0, 3).join(' ');
      const chunkIdx = new Set();
      for (const s of grounding.supports) if (s.text.includes(key)) s.idx.forEach((i) => chunkIdx.add(i));
      const domains = [...new Set([...chunkIdx].map((i) => grounding.sources[i]?.domain).filter(Boolean))];
      const pos = osm ? { lat: osm.lat, lon: osm.lon } : found;
      if (!pos) continue; // can't place it on the map, so don't show it
      const score = (osm ? 1 : 0) + (osm?.famous ? 2 : 0) + Math.min(domains.length, 3);
      items.push({
        name: p.name, lat: pos.lat, lon: pos.lon,
        why: p.why || '', bestTime: p.bestTime || '', tags: (p.tags || []).slice(0, 3),
        kind: osm?.kind || '', inOsm: !!osm, famous: !!osm?.famous,
        sources: domains.slice(0, 4), mentions: domains.length,
        trust: score, trusted: score >= 3 || (domains.length >= 2)
      });
    }
  }
  if (!items.length) {
    // No AI: best-known OpenStreetMap places
    items = candidates.slice(0, 15).map((c) => ({
      name: c.name, lat: c.lat, lon: c.lon, why: [c.kind, c.cuisine].filter(Boolean).join(' · '), bestTime: '', tags: c.famous ? ['Popular'] : [],
      kind: c.kind, inOsm: true, famous: c.famous, sources: [], mentions: 0, trust: c.famous ? 3 : 1, trusted: c.famous
    }));
    if (mode !== 'none') mode = 'osm';
  }
  send({ type: 'step', id: 'verify', status: 'done', count: items.length });

  items = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lon)).map((i, n) => ({ id: `${n}-${i.name}`.slice(0, 80), ...i }));
  return { area, items, mode, sources: sourceList.slice(0, 16), entryPoint: grounding.entryPoint, ai: mode === 'web' || mode === 'ai' };
}

const clean = (o) => JSON.parse(JSON.stringify(o)); // drop undefined for Firestore

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ type: 'error', message: 'Use POST' });
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch { /* client left */ } };

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const cat = String(body.cat || '');
    const lat = Number(body.lat), lon = Number(body.lon);
    if (!DISCOVER_CATS[cat] || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
      send({ type: 'error', message: 'Bad request' });
      return res.end();
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
        if (d.v === DISCOVER_VERSION && age < FRESH_DAYS * DAY && !wantsRefresh && d.items?.length) {
          ref.update({ searches: FieldValue.increment(1) }).catch(() => {});
          send({ type: 'sources', sources: d.sources || [] });
          send({ type: 'result', data: { status: 'ok', cached: true, key, ...d, searches: (d.searches || 0) + 1 } });
          return res.end();
        }
      }
    }

    const result = await generate(cat, center, place, send);
    if (!result.items.length) {
      send({ type: 'result', data: { status: 'empty', key, area: result.area } });
      return res.end();
    }
    const doc = clean({ v: DISCOVER_VERSION, cat, key, center, ...result, updatedAt: Date.now() });
    if (ref) await ref.set({ ...doc, searches: FieldValue.increment(1) }, { merge: true });
    send({ type: 'result', data: { status: 'ok', cached: false, saved: !!ref, key, ...doc, searches: 1 } });
    return res.end();
  } catch (e) {
    console.error(e);
    send({ type: 'error', message: 'Could not find places right now. Try again in a minute.' });
    return res.end();
  }
}
