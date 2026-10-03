// All data sources here are free and need no API key.
// Open-Meteo (weather, time zone, geocoding), Nominatim (OSM geocoding),
// Overpass (OSM places nearby), Wikivoyage (guides, food, scams).

const cache = new Map();
async function getJSON(url, opts = {}, ttl = 10 * 60 * 1000) {
  const key = url + (opts.body || '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const v = await res.json();
  cache.set(key, { t: Date.now(), v });
  return v;
}

/* ---------------- Places search ---------------- */

export async function searchPlaces(q) {
  if (!q || q.trim().length < 2) return [];
  const query = encodeURIComponent(q.trim());
  const out = [];
  try {
    const om = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=6&language=en&format=json`);
    (om.results || []).forEach((r) => out.push({
      id: `om-${r.id}`, name: r.name, region: [r.admin1, r.country].filter(Boolean).join(', '),
      lat: r.latitude, lon: r.longitude, kind: 'city', population: r.population || 0, elevation: r.elevation
    }));
  } catch { /* fall through to Nominatim */ }
  if (out.length < 3) {
    try {
      const nm = await getJSON(`https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&limit=6&addressdetails=1`);
      nm.forEach((r) => {
        if (out.some((o) => Math.abs(o.lat - r.lat) < 0.02 && Math.abs(o.lon - r.lon) < 0.02)) return;
        const a = r.address || {};
        out.push({
          id: `nm-${r.osm_id}`, name: r.name || r.display_name.split(',')[0],
          region: [a.city || a.town || a.state, a.country].filter(Boolean).join(', '),
          lat: +r.lat, lon: +r.lon, kind: r.addresstype || r.type
        });
      });
    } catch { /* ignore */ }
  }
  return out;
}

export async function reverseGeocode(lat, lon) {
  try {
    const r = await getJSON(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10`);
    const a = r.address || {};
    return { name: a.city || a.town || a.village || a.county || a.state || 'Near you', region: [a.state, a.country].filter(Boolean).join(', ') };
  } catch {
    return { name: 'Near you', region: '' };
  }
}

export function getMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location not supported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/* ---------------- Weather + local time ---------------- */

const WMO = {
  0: ['Clear', 'clear'], 1: ['Mostly clear', 'clear'], 2: ['Partly cloudy', 'cloudy'], 3: ['Overcast', 'cloudy'],
  45: ['Fog', 'cloudy'], 48: ['Fog', 'cloudy'], 51: ['Drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 71: ['Snow', 'snow'], 73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'], 80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
  95: ['Thunderstorm', 'rain'], 96: ['Thunderstorm', 'rain'], 99: ['Thunderstorm', 'rain']
};

export async function getWeather(lat, lon) {
  const d = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`,
    {}, 15 * 60 * 1000
  );
  const [label, kind] = WMO[d.current?.weather_code] || ['—', 'clear'];
  return {
    temp: Math.round(d.current?.temperature_2m),
    label, kind,
    timezone: d.timezone,
    elevation: d.elevation,
    daily: (d.daily?.time || []).map((t, i) => ({
      date: t, max: Math.round(d.daily.temperature_2m_max[i]), min: Math.round(d.daily.temperature_2m_min[i])
    }))
  };
}

export function localTime(timezone, date = new Date()) {
  try {
    const time = date.toLocaleTimeString('en-IN', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true });
    const hour = +date.toLocaleString('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).slice(0, 2);
    const weekday = date.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'short' });
    return { time: time.toUpperCase(), hour, weekday };
  } catch {
    return { time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), hour: date.getHours(), weekday: '' };
  }
}

/* ---------------- Nearby places (OpenStreetMap) ---------------- */

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export const CATEGORIES = {
  cafe: { label: 'Cafes', icon: 'cafe', tone: '#DCE8E4' },
  family: { label: 'Family dining', icon: 'food', tone: '#F6E6B8' },
  food: { label: 'Street food', icon: 'food', tone: '#F2D9C4' },
  couple: { label: 'Couple spots', icon: 'heart', tone: '#F3D6D6' },
  sight: { label: 'Popular spots', icon: 'star', tone: '#E3E0F3' },
  stay: { label: 'Stays', icon: 'bed', tone: '#E6E1D8' },
  busy: { label: 'Busy places', icon: 'people', tone: '#F3DCD0' }
};

function classify(t) {
  if (t.amenity === 'cafe') return 'cafe';
  if (t.amenity === 'restaurant') return 'family';
  if (t.amenity === 'fast_food' || t.amenity === 'food_court' || t.shop === 'bakery' || t.shop === 'confectionery') return 'food';
  if (t.tourism === 'viewpoint' || t.leisure === 'garden' || t.leisure === 'park' || t.natural === 'beach' || t.tourism === 'picnic_site') return 'couple';
  if (t.tourism === 'hotel' || t.tourism === 'guest_house' || t.tourism === 'hostel') return 'stay';
  if (t.amenity === 'marketplace' || t.shop === 'mall' || t.place === 'square') return 'busy';
  if (t.tourism || t.historic || t.amenity === 'place_of_worship') return 'sight';
  return null;
}

export async function getNearby(lat, lon, radius = 4000) {
  const r = radius;
  const q = `[out:json][timeout:25];(
    nwr(around:${r},${lat},${lon})[amenity~"^(cafe|restaurant|fast_food|food_court|marketplace)$"][name];
    nwr(around:${r},${lat},${lon})[tourism~"^(attraction|museum|viewpoint|zoo|theme_park|gallery|hotel|guest_house|hostel|picnic_site)$"][name];
    nwr(around:${r},${lat},${lon})[historic~"^(monument|castle|fort|palace|memorial|ruins|archaeological_site)$"][name];
    nwr(around:${r},${lat},${lon})[leisure~"^(park|garden)$"][name];
    nwr(around:${r},${lat},${lon})[shop~"^(mall|bakery|confectionery)$"][name];
    nwr(around:${r},${lat},${lon})[natural=beach][name];
  );out center tags 400;`;
  let data;
  for (const url of OVERPASS) {
    try {
      data = await getJSON(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 60 * 60 * 1000);
      break;
    } catch { /* try next mirror */ }
  }
  if (!data) throw new Error('Places service is busy, try again in a minute');
  const groups = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, []]));
  const seen = new Set();
  for (const el of data.elements || []) {
    const t = el.tags || {};
    const cat = classify(t);
    if (!cat || seen.has(t.name)) continue;
    seen.add(t.name);
    const plat = el.lat ?? el.center?.lat;
    const plon = el.lon ?? el.center?.lon;
    groups[cat].push({
      id: `osm-${el.type}-${el.id}`,
      name: t['name:en'] || t.name,
      lat: plat, lon: plon, cat,
      cuisine: t.cuisine?.replace(/;/g, ', ').replace(/_/g, ' '),
      hours: t.opening_hours,
      phone: t.phone || t['contact:phone'],
      website: t.website || t['contact:website'],
      stars: t.stars,
      kindLabel: t.tourism || t.historic || t.amenity || t.leisure || t.shop,
      dist: distanceKm(lat, lon, plat, plon),
      important: !!(t.wikipedia || t.wikidata)
    });
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => (b.important - a.important) || (a.dist - b.dist));
  }
  // Busy places = markets/malls plus the most famous sights
  groups.busy = [...groups.busy, ...groups.sight.filter((s) => s.important).slice(0, 6)];
  return groups;
}

export function distanceKm(a1, o1, a2, o2) {
  const R = 6371, dA = ((a2 - a1) * Math.PI) / 180, dO = ((o2 - o1) * Math.PI) / 180;
  const x = Math.sin(dA / 2) ** 2 + Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function mapsLink(p) {
  if (p.lat != null && p.lon != null) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.city].filter(Boolean).join(' '))}`;
}

/* ---------------- Travel guide (Wikivoyage) ---------------- */

const WV = 'https://en.wikivoyage.org/w/api.php?format=json&origin=*';
const SCAM_WORDS = /scam|tout|fake|overcharg|pickpocket|commission|fraud|cheat|beware|theft|con artist|rip.?off|swindl|snatch|bargain hard|haggle|insist|meter/i;

function cleanText(s) {
  return s.replace(/\[\d+\]|\[edit\]/g, '').replace(/\s+/g, ' ').replace(/\s([,.;])/g, '$1').trim();
}

function parseSection(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('.mw-editsection, sup, style, .listing-metadata, .listing-coordinates, .noprint').forEach((n) => n.remove());
  const items = [];
  doc.querySelectorAll('li').forEach((li) => {
    const nameEl = li.querySelector('.listing-name, .fn, b');
    if (!nameEl) return;
    const name = cleanText(nameEl.textContent);
    if (!name || name.length > 70) return;
    let desc = cleanText(li.textContent.replace(nameEl.textContent, ''));
    desc = desc.replace(/^[\s,.\-–:]+/, '').replace(/☎.*?(?=[A-Z][a-z]{2,} )/g, '');
    items.push({ name, desc: desc.length > 220 ? desc.slice(0, 217) + '…' : desc });
  });
  const paras = [...doc.querySelectorAll('p')].map((p) => cleanText(p.textContent)).filter((t) => t.length > 30);
  const terms = [...doc.querySelectorAll('p b, p i')].map((b) => cleanText(b.textContent)).filter((t) => t.length > 2 && t.length < 40);
  return { items, paras, terms };
}

async function wvSection(title, index) {
  const d = await getJSON(`${WV}&action=parse&page=${encodeURIComponent(title)}&prop=text&section=${index}&redirects=1`, {}, 24 * 3600 * 1000);
  return parseSection(d.parse?.text?.['*'] || '');
}

export async function getGuide(name) {
  const s = await getJSON(`${WV}&action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=1&srnamespace=0`, {}, 24 * 3600 * 1000);
  const title = s.query?.search?.[0]?.title;
  if (!title) return null;
  const [secs, intro] = await Promise.all([
    getJSON(`${WV}&action=parse&page=${encodeURIComponent(title)}&prop=sections&redirects=1`, {}, 24 * 3600 * 1000),
    getJSON(`${WV}&action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&redirects=1`, {}, 24 * 3600 * 1000)
  ]);
  const sections = secs.parse?.sections || [];
  const find = (re) => sections.find((x) => re.test(x.line.replace(/<[^>]+>/g, '')));
  const want = { see: find(/^See$/i), do: find(/^Do$/i), eat: find(/^Eat$/i), drink: find(/^Drink$/i), sleep: find(/^Sleep$/i), safe: find(/^Stay safe$/i), buy: find(/^Buy$/i) };
  const parts = {};
  await Promise.all(Object.entries(want).map(async ([k, sec]) => {
    if (!sec) return;
    try { parts[k] = await wvSection(title, sec.index); } catch { /* skip */ }
  }));
  const pages = intro.query?.pages || {};
  const summary = (Object.values(pages)[0]?.extract || '').split('\n')[0];

  // Scams: sentences from Stay safe (and Buy) that mention scam-type words
  const pool = [...(parts.safe?.paras || []), ...(parts.safe?.items || []).map((i) => `${i.name}: ${i.desc}`), ...(parts.buy?.paras || [])];
  const sentences = pool.flatMap((p) => p.split(/(?<=[.!?])\s+(?=[A-Z])/));
  let scams = sentences.filter((t) => SCAM_WORDS.test(t) && t.length < 320);
  scams = [...new Set(scams)].slice(0, 8);
  const safetyTips = scams.length ? [] : (parts.safe?.paras || []).slice(0, 3);

  // Famous food: bold/italic dish names in Eat paragraphs
  const dishes = [...new Set((parts.eat?.terms || []).filter((t) => !/^(budget|mid-range|splurge)$/i.test(t)))].slice(0, 12);

  return {
    title,
    url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    summary: summary.length > 320 ? summary.slice(0, 317) + '…' : summary,
    see: parts.see?.items || [],
    do: parts.do?.items || [],
    eat: parts.eat?.items || [],
    drink: parts.drink?.items || [],
    sleep: parts.sleep?.items || [],
    dishes, scams, safetyTips
  };
}

/* ---------------- Scene type + crowd estimate + itinerary ---------------- */

export function detectSceneKind({ name = '', summary = '', elevation = 0 }) {
  const t = `${name} ${summary}`.toLowerCase();
  if (/\bbeach|coast|seaside|island|goa\b/.test(t)) return 'beach';
  if (elevation > 1400 || /hill station|himalay|mountain|alps|valley|snow/.test(t)) return 'mountain';
  if (/desert|dunes|thar|sahara/.test(t)) return 'desert';
  if (/\blake|lakes\b/.test(t)) return 'lake';
  return 'city';
}

// Rough crowd estimate from the type of place and local time (no paid data).
export function estimateCrowd(cat, hour, weekday) {
  const weekend = /Sat|Sun/.test(weekday || '');
  const curves = {
    cafe: [[8, 11, 2], [11, 16, 1], [16, 22, 3]],
    family: [[12, 15, 3], [19, 23, 3], [15, 19, 1]],
    food: [[17, 23, 3], [11, 15, 2]],
    sight: [[10, 13, 3], [13, 17, 2], [8, 10, 1]],
    couple: [[17, 20, 3], [6, 9, 1], [9, 17, 2]],
    busy: [[17, 22, 3], [11, 17, 2]],
    stay: [[0, 24, 1]]
  };
  let level = 0;
  for (const [a, b, l] of curves[cat] || []) if (hour >= a && hour < b) level = Math.max(level, l);
  if (weekend && level > 0 && level < 3) level += 1;
  return ['Quiet', 'Calm', 'Moderate', 'Busy'][Math.min(level, 3)];
}

export function buildItinerary(guide, nearby, maxDays = 3) {
  const sights = [
    ...(guide?.see || []).map((s) => ({ name: s.name, note: s.desc })),
    ...(guide?.do || []).slice(0, 4).map((s) => ({ name: s.name, note: s.desc })),
    ...(nearby?.sight || []).filter((s) => s.important).map((s) => ({ name: s.name, note: s.kindLabel, lat: s.lat, lon: s.lon }))
  ];
  const evening = (nearby?.couple || []).slice(0, maxDays).map((s) => ({ name: s.name, note: 'Good for sunset and an easy evening', lat: s.lat, lon: s.lon }));
  const eats = [...(guide?.eat || []).map((e) => ({ name: e.name, note: e.desc })), ...(nearby?.family || []).slice(0, 4).map((s) => ({ name: s.name, note: s.cuisine || 'Restaurant', lat: s.lat, lon: s.lon }))];
  const uniq = (arr) => arr.filter((x, i) => x.name && arr.findIndex((y) => y.name === x.name) === i);
  const S = uniq(sights);
  const days = Math.max(1, Math.min(maxDays, Math.ceil(S.length / 3)));
  const out = [];
  for (let d = 0; d < days; d++) {
    const stops = [];
    const m = S[d * 3], a = S[d * 3 + 1], a2 = S[d * 3 + 2];
    if (m) stops.push({ time: 'Morning', ...m });
    if (a) stops.push({ time: 'Afternoon', ...a });
    if (eats[d]) stops.push({ time: 'Lunch', ...eats[d] });
    stops.push(evening[d] ? { time: 'Evening', ...evening[d] } : a2 ? { time: 'Evening', ...a2 } : null);
    out.push({ title: `Day ${d + 1}`, stops: stops.filter(Boolean) });
  }
  return out.filter((d) => d.stops.length);
}
