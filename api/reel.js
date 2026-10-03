// Vercel serverless function: turns a reel/post link or a pasted caption into a trip.
// POST { url?: string, caption?: string }
// -> { status: 'ok', trip, text } | { status: 'need_caption' } | { status: 'nothing_found', text } | { status: 'error', message }

const UA_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const UA_BROWSER = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

function decode(s = '') {
  return s
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function metas(html) {
  const out = {};
  const re = /<meta\s+[^>]*(?:property|name)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>|<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const key = (m[1] || m[4] || '').toLowerCase();
    const val = decode(m[2] ?? m[3] ?? '');
    if (key && val && !out[key]) out[key] = val;
  }
  return out;
}

async function fetchText(url, ua) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; } finally { clearTimeout(t); }
}

async function textFromLink(raw) {
  let url;
  try { url = new URL(raw.trim()); } catch { return ''; }
  if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return '';
  const host = url.hostname.replace(/^www\./, '');
  const parts = [];

  if (/instagram\.com|instagr\.am/.test(host)) {
    const m = url.pathname.match(/\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const clean = `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`;
      // 1) Embed page usually carries the full caption
      const embed = await fetchText(`https://www.instagram.com/p/${m[2]}/embed/captioned/`, UA_BROWSER);
      const cap = embed.match(/class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i);
      if (cap) parts.push(decode(cap[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')));
      // 2) Link preview tags (what WhatsApp shows)
      const page = await fetchText(clean, UA_CRAWLER);
      const mt = metas(page);
      if (mt['og:title']) parts.push(mt['og:title']);
      if (mt['og:description']) parts.push(mt['og:description']);
    }
  } else if (/youtube\.com|youtu\.be/.test(host)) {
    try {
      const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(raw)}`).then((r) => r.json());
      if (o?.title) parts.push(o.title);
    } catch { /* ignore */ }
    const mt = metas(await fetchText(raw, UA_BROWSER));
    if (mt['og:description']) parts.push(mt['og:description']);
  } else {
    const mt = metas(await fetchText(raw, UA_BROWSER));
    ['og:title', 'og:description', 'description', 'twitter:description'].forEach((k) => mt[k] && parts.push(mt[k]));
  }

  return [...new Set(parts.map((p) => p.replace(/\s+\n/g, '\n').trim()).filter(Boolean))].join('\n\n');
}

function usefulLength(text) {
  // Strip hashtags, mentions and generic Instagram boilerplate before judging
  return text
    .replace(/#[\wऀ-ॿ]+/g, '')
    .replace(/@[\w.]+/g, '')
    .replace(/\d+[KkMm]? (likes|comments)[^\n]*/g, '')
    .replace(/on Instagram:?/gi, '')
    .replace(/\s+/g, ' ').trim().length;
}

const PROMPT = `You turn travel social-media captions into a trip itinerary.
Read the caption and return ONLY JSON in this exact shape:
{"destination": string (main city/region, "" if unknown),
 "title": string (short trip name),
 "days": [{"title": string, "stops": [{"name": string, "time": "Morning"|"Afternoon"|"Lunch"|"Evening"|"Night"|"", "note": string}]}],
 "food": [string],  "cafes": [string], "stays": [string], "tips": [string], "scams": [string]}
Rules:
- Only include places, food, cafes and stays that the caption actually mentions. Never invent places.
- Keep the creator's order. If the caption has day-wise plans, follow them; otherwise put stops in "Day 1", then split into days of about 4 stops.
- "note" is a short helpful line from the caption (price, timing, tip), or "".
- If the caption mentions no real places, return {"destination":"","title":"","days":[],"food":[],"cafes":[],"stays":[],"tips":[],"scams":[]}.

Caption:
"""
`;

async function askGemini(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: PROMPT + text.slice(0, 6000) + '\n"""' }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
    })
  });
  if (!r.ok) throw new Error(`AI service error ${r.status}`);
  const data = await r.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return JSON.parse(out.replace(/^```json|```$/g, '').trim());
}

// No-AI fallback: pick lines that look like listed places (📍, numbers, bullets)
function simpleExtract(text) {
  const lines = text.split(/\n|•|➡️|👉/).map((l) => l.trim()).filter(Boolean);
  const picks = [];
  for (const l of lines) {
    const m = l.match(/^(?:📍|📌|\d{1,2}[.)]|[-–*]|✅|⭐)\s*(.+)/u);
    if (m) {
      const name = m[1].replace(/#[\w]+/g, '').split(/[-–:|,(]/)[0].trim();
      if (name.length > 2 && name.length < 60) picks.push({ name, time: '', note: '' });
    }
  }
  if (!picks.length) return null;
  const days = [];
  for (let i = 0; i < picks.length; i += 4) days.push({ title: `Day ${days.length + 1}`, stops: picks.slice(i, i + 4) });
  return { destination: '', title: 'Trip from reel', days, food: [], cafes: [], stays: [], tips: [], scams: [] };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Use POST' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = (body.url || '').slice(0, 500);
    const caption = (body.caption || '').slice(0, 6000);

    let text = caption;
    if (!text && url) text = await textFromLink(url);
    if (!text || usefulLength(text) < 25) return res.status(200).json({ status: 'need_caption', text });

    let trip = null;
    try { trip = await askGemini(text); } catch (e) { console.error(e); }
    if (!trip) trip = simpleExtract(text);

    const stops = (trip?.days || []).reduce((n, d) => n + (d.stops?.length || 0), 0);
    if (!trip || (stops === 0 && !(trip.food || []).length && !(trip.cafes || []).length)) {
      return res.status(200).json({ status: 'nothing_found', text });
    }
    return res.status(200).json({ status: 'ok', trip, text });
  } catch (e) {
    return res.status(200).json({ status: 'error', message: e.message || 'Something went wrong' });
  }
}
