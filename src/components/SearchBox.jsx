import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { searchPlaces, getMyLocation, reverseGeocode } from '../lib/api.js';

export const placeUrl = (p, tab) => {
  const q = new URLSearchParams({ name: p.name, lat: (+p.lat).toFixed(4), lon: (+p.lon).toFixed(4) });
  if (p.region) q.set('region', p.region);
  if (tab) q.set('tab', tab);
  return `/place?${q}`;
};

export const looksLikeLink = (s) => /https?:\/\/|instagram\.com|instagr\.am|youtu/i.test(s);

export default function SearchBox({ placeholder = 'Search any city, place or cafe', tab, autoFocus, style }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim() || looksLikeLink(q)) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await searchPlaces(q)); } finally { setBusy(false); }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    if (looksLikeLink(q)) return nav(`/import?url=${encodeURIComponent(q.trim())}`);
    if (results[0]) nav(placeUrl(results[0], tab));
  };

  const nearMe = async () => {
    setBusy(true);
    try {
      const { lat, lon } = await getMyLocation();
      const where = await reverseGeocode(lat, lon);
      localStorage.setItem('wanderpin:lastLoc', JSON.stringify({ lat, lon, ...where }));
      nav(placeUrl({ ...where, lat, lon }, tab));
    } catch {
      alert('Location is off. Allow location access, or search a place by name.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ position: 'relative', ...style }} role="search">
      <label className="search">
        <Icon name="search" size={18} />
        <input
          value={q} autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          aria-label="Search places or paste a reel link"
          enterKeyHint="search"
        />
        <button type="button" onClick={nearMe} aria-label="Search near me" className="icon-btn" style={{ border: 'none', background: 'var(--ink)', color: 'var(--paper)' }}>
          <Icon name="locate" size={18} />
        </button>
      </label>
      {open && (results.length > 0 || busy || looksLikeLink(q)) && (
        <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 62, zIndex: 40, padding: 6, boxShadow: '0 12px 30px rgba(43,36,32,.15)' }}>
          {looksLikeLink(q) && (
            <button type="submit" className="row" style={{ width: '100%', border: 'none', background: 'none', padding: 12, textAlign: 'left', gap: 12 }}>
              <Icon name="reel" /> <span><b>Build a trip from this link</b></span>
            </button>
          )}
          {busy && !results.length && <div className="sub" style={{ padding: 12 }}>Searching…</div>}
          {results.map((r) => (
            <button key={r.id} type="button" onMouseDown={() => nav(placeUrl(r, tab))}
              className="row" style={{ width: '100%', border: 'none', background: 'none', padding: 12, textAlign: 'left', gap: 12, borderRadius: 12 }}>
              <Icon name="pin" size={18} />
              <span className="grow"><b>{r.name}</b><br /><span className="sub" style={{ fontSize: 13 }}>{r.region}</span></span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
