import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TopBar, SaveButton } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import Globe from '../components/Globe.jsx';
import { ReportSheet } from './Place.jsx';
import { getDiscover, DISCOVER_CATS, REFRESH_DAYS, cellOf, ageLabel } from '../lib/discover.js';
import { searchPlaces, getMyLocation, reverseGeocode, mapsLink, distanceKm } from '../lib/api.js';
import { useIsDesktop } from '../lib/useMedia.js';

// If the map fails (old browser, blocked tiles), keep the list usable
class MapBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="empty" style={{ height: '100%', justifyContent: 'center' }}>The map couldn't load here, but the list still works.</div>;
    return this.props.children;
  }
}

const pin = (n, active, ai) => L.divIcon({
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:15px;display:flex;align-items:center;justify-content:center;font:700 13px 'DM Sans',sans-serif;
    background:${active ? '#2B2420' : ai ? '#E9C46A' : '#B5694A'};color:${ai && !active ? '#2B2420' : '#FFFDF9'};border:2px solid #FFFDF9;box-shadow:0 4px 10px rgba(43,36,32,.3)">${n}</div>`
});

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 14), { duration: 0.8 }); }, [target, map]);
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lon], 12); }, [center.lat, center.lon]); // eslint-disable-line
  return null;
}

function WatchMove({ onMove }) {
  useMapEvents({ moveend: (e) => { const c = e.target.getCenter(); onMove({ lat: c.lat, lon: c.lng }); } });
  return null;
}

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const cat = DISCOVER_CATS[params.get('cat')] ? params.get('cat') : 'food';
  const lat = params.get('lat') ? +params.get('lat') : null;
  const lon = params.get('lon') ? +params.get('lon') : null;
  const name = params.get('name') || '';
  const desktop = useIsDesktop();

  const [state, setState] = useState({ status: lat == null ? 'need_place' : 'loading' });
  const [mapCenter, setMapCenter] = useState(null);
  const [active, setActive] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const listRefs = useRef({});

  const setPlace = (p, extra = {}) => setParams((q) => {
    q.set('cat', extra.cat || cat);
    if (p) { q.set('lat', (+p.lat).toFixed(4)); q.set('lon', (+p.lon).toFixed(4)); if (p.name) q.set('name', p.name); else q.delete('name'); }
    return q;
  }, { replace: !!extra.replace });

  const load = async (refresh = false) => {
    if (lat == null) { setState({ status: 'need_place' }); return; }
    setState({ status: 'loading' });
    setActive(null);
    try {
      setState(await getDiscover(cat, lat, lon, { place: name, refresh }));
    } catch {
      setState({ status: 'error', message: 'Could not reach Wanderpin. Check your connection.' });
    }
  };

  useEffect(() => { load(); }, [cat, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = state.items || [];
  const center = lat != null ? { lat, lon } : null;
  const sameCell = (a, b) => { const x = cellOf(a.lat, a.lon), y = cellOf(b.lat, b.lon); return x.i === y.i && x.j === y.j; };
  const moved = !!(mapCenter && center && !sameCell(mapCenter, center));
  const age = state.updatedAt ? Date.now() - state.updatedAt : 0;
  const canRefresh = age > REFRESH_DAYS * 86400000;
  const label = DISCOVER_CATS[cat].label;
  const area = state.area || name;

  const sorted = useMemo(() => items.map((it, i) => ({ ...it, n: i + 1, dist: center ? distanceKm(center.lat, center.lon, it.lat, it.lon) : null })), [items]); // eslint-disable-line

  const focus = (it) => {
    setActive(it);
    listRefs.current[it.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  return (
    <div className="page">
      <TopBar title={label} />

      <div className="chips" role="tablist" aria-label="What are you looking for?">
        {Object.entries(DISCOVER_CATS).map(([k, c]) => (
          <button key={k} role="tab" aria-selected={k === cat} className={`chip row ${k === cat ? 'on' : ''}`} style={{ gap: 6 }}
            onClick={() => setPlace(center ? { ...center, name } : null, { cat: k, replace: true })}>
            <Icon name={c.icon} size={16} />{c.label}
          </button>
        ))}
      </div>

      <LocationPicker current={area} onPick={(p) => setPlace(p)} />

      {state.status === 'need_place' && (
        <div className="empty card" style={{ padding: 32 }}>
          <Icon name="pin" size={32} />
          <b style={{ fontSize: 18, color: 'var(--ink)' }}>Where should we look for {label.toLowerCase()}?</b>
          <div>Use your location or search a city above, like Lucknow, Goa or Manali.</div>
        </div>
      )}

      {center && (
        <div className="discover-layout">
          <div className="discover-map">
            <MapBoundary>
            <MapContainer center={[center.lat, center.lon]} zoom={12} scrollWheelZoom={desktop} style={{ height: '100%', width: '100%', borderRadius: 22 }}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Recenter center={center} />
              <WatchMove onMove={setMapCenter} />
              <FlyTo target={active} />
              <Circle center={[cellOf(lat, lon).center.lat, cellOf(lat, lon).center.lon]} radius={11000}
                pathOptions={{ color: '#B5694A', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }} />
              {sorted.map((it) => (
                <Marker key={it.id} position={[it.lat, it.lon]} icon={pin(it.n, active?.id === it.id, it.source === 'ai')}
                  eventHandlers={{ click: () => focus(it) }} title={it.name} />
              ))}
            </MapContainer>
            </MapBoundary>
            {moved && (
              <button className="btn" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 500, height: 42, boxShadow: '0 8px 20px rgba(43,36,32,.25)' }}
                onClick={async () => {
                  const where = await reverseGeocode(mapCenter.lat, mapCenter.lon);
                  setPlace({ ...mapCenter, name: where.name });
                  setMapCenter(null);
                }}>
                <Icon name="search" size={18} />Search this area
              </button>
            )}
          </div>

          <div className="discover-list">
            {state.status === 'loading' && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
                <Globe size={90} />
                <b style={{ fontSize: 18 }}>Finding the best {label.toLowerCase()}{area ? ` around ${area}` : ''}…</b>
                <div className="sub" style={{ maxWidth: 360 }}>If nobody has searched this area yet, our AI checks real places on the map. It takes a few seconds the first time, then it's instant for everyone.</div>
              </div>
            )}

            {state.status === 'ok' && (
              <>
                <div className="row wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 24 }}>{label} in {area}</h2>
                    <div className="sub" style={{ fontSize: 13 }}>
                      {state.ai ? 'AI picks from real places' : 'Popular places from OpenStreetMap'} · {ageLabel(state.updatedAt)}
                      {state.searches > 1 ? ` · searched ${state.searches} times` : ''}
                    </div>
                  </div>
                  {canRefresh && <button className="chip row" style={{ gap: 6 }} onClick={() => load(true)}><Icon name="clock" size={16} />Refresh picks</button>}
                </div>
                <div className="list single">
                  {sorted.map((it) => (
                    <div key={it.id} ref={(el) => { listRefs.current[it.id] = el; }}
                      className="card" onClick={() => setActive(it)}
                      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', outline: active?.id === it.id ? '2px solid var(--ink)' : 'none' }}>
                      <span style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0, background: it.source === 'ai' ? '#E9C46A' : 'var(--accent)', color: it.source === 'ai' ? 'var(--ink)' : 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{it.n}</span>
                      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <b style={{ fontSize: 16 }}>{it.name}</b>
                        {it.why && <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' }}>{it.why}</div>}
                        <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
                          {it.bestTime && <span className="tag" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}><Icon name="clock" size={12} />{it.bestTime}</span>}
                          {(it.tags || []).map((t) => <span key={t} className="tag" style={{ background: 'var(--cream)', border: '1px solid var(--line)' }}>{t}</span>)}
                          {it.source === 'ai' && <span className="tag" style={{ background: 'var(--sand-soft)' }}>Local favourite</span>}
                          {it.dist != null && <span className="sub" style={{ fontSize: 12 }}>{it.dist.toFixed(1)} km</span>}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <a className="icon-btn" style={{ width: 40, height: 40 }} href={mapsLink(it)} target="_blank" rel="noreferrer" aria-label={`Directions to ${it.name}`}><Icon name="route" size={18} /></a>
                        <SaveButton item={{ type: cat === 'sight' || cat === 'busy' || cat === 'quiet' ? 'sight' : cat === 'stay' ? 'stay' : cat === 'couple' ? 'couple' : cat === 'cafe' ? 'cafe' : 'food', name: it.name, lat: it.lat, lon: it.lon, city: area, note: it.why }} size={40} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="sub" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  These picks are shared with every Wanderpin traveller searching this area, and refresh every month. Always check opening hours before you go.
                  {' '}<button className="linkish" style={{ fontSize: 12 }} onClick={() => setReportOpen(true)}>Report a wrong place</button>
                </div>
              </>
            )}

            {state.status === 'empty' && (
              <div className="empty card"><Icon name="search" size={28} /><div>We couldn't find {label.toLowerCase()} around {area || 'here'}. Try moving the map to a busier area or another category.</div></div>
            )}

            {state.status === 'error' && (
              <div className="alert" style={{ flexDirection: 'column', gap: 10 }}>
                <b>{state.message || 'Something went wrong.'}</b>
                <button className="btn" style={{ alignSelf: 'flex-start', height: 40 }} onClick={() => load()}>Try again</button>
              </div>
            )}
          </div>
        </div>
      )}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={{ type: 'place', destination: `${label} · ${area}`, url: window.location.href }} />
      {lat != null && <Link to={`/place?name=${encodeURIComponent(area || 'This place')}&lat=${lat}&lon=${lon}`} className="sub" style={{ textAlign: 'center' }}>Open the full {area || 'place'} guide</Link>}
    </div>
  );
}

function LocationPicker({ current, onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setResults([]); return; }
    t.current = setTimeout(async () => { try { setResults(await searchPlaces(q)); } catch { setResults([]); } }, 350);
    return () => clearTimeout(t.current);
  }, [q]);
  const nearMe = async () => {
    setBusy(true);
    try {
      const { lat, lon } = await getMyLocation();
      const where = await reverseGeocode(lat, lon);
      onPick({ lat, lon, name: where.name });
    } catch { alert('Location is off. Search a city instead.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'relative' }}>
      <form className="search" onSubmit={(e) => { e.preventDefault(); if (results[0]) { onPick(results[0]); setQ(''); setResults([]); } }}>
        <Icon name="pin" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={current ? `Searching around ${current}. Change city…` : 'Search a city or area, e.g. Lucknow'} aria-label="City or area" />
        <button type="button" className="icon-btn" style={{ border: 'none', background: 'var(--ink)', color: 'var(--paper)' }} onClick={nearMe} aria-label="Use my location" disabled={busy}><Icon name="locate" size={18} /></button>
      </form>
      {results.length > 0 && (
        <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 62, zIndex: 600, padding: 6, boxShadow: '0 12px 30px rgba(43,36,32,.15)' }}>
          {results.map((r) => (
            <button key={r.id} type="button" className="row" onClick={() => { onPick(r); setQ(''); setResults([]); }}
              style={{ width: '100%', border: 'none', background: 'none', padding: 12, textAlign: 'left', gap: 12, borderRadius: 12 }}>
              <Icon name="pin" size={18} /><span className="grow"><b>{r.name}</b><br /><span className="sub" style={{ fontSize: 13 }}>{r.region}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
