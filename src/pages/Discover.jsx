import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TopBar, SaveButton } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import Globe from '../components/Globe.jsx';
import { ReportSheet } from './Place.jsx';
import { getDiscover, DISCOVER_CATS, REFRESH_DAYS, cellOf, ageLabel, favicon, getAreaPlaces, googleMapsSearch } from '../lib/discover.js';
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

const pin = (n, active, trusted) => L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="position:relative;width:34px;height:34px;border-radius:17px;display:flex;align-items:center;justify-content:center;font:700 13px 'DM Sans',sans-serif;
    background:${active ? '#2B2420' : trusted ? '#B5694A' : '#FFFDF9'};color:${active || trusted ? '#FFFDF9' : '#2B2420'};
    border:2px solid ${trusted || active ? '#FFFDF9' : '#2B2420'};box-shadow:0 4px 10px rgba(43,36,32,.3)">${n}
    ${trusted ? '<span style="position:absolute;top:-7px;right:-7px;width:18px;height:18px;border-radius:9px;background:#E9C46A;color:#2B2420;font-size:11px;display:flex;align-items:center;justify-content:center;border:1.5px solid #FFFDF9">★</span>' : ''}</div>`
});

// What we look across before the real sources come back
const LOOKING_AT = [
  { domain: 'google.com', label: 'Google Search' },
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'openstreetmap.org', label: 'OpenStreetMap' },
  { domain: 'wikivoyage.org', label: 'Wikivoyage' },
  { domain: 'blogger.com', label: 'Travel blogs' }
];

const STEPS = [
  ['map', 'Checking real places on the map'],
  ['web', 'Searching blogs, Instagram, travel and review sites'],
  ['verify', 'Pinning places and checking how trusted they are']
];

function FlyTo({ target, zoom = 14 }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), zoom), { duration: 0.8 }); }, [target, map, zoom]);
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lon], 12); }, [center.lat, center.lon]); // eslint-disable-line
  return null;
}

// dragend = the user moved the map by hand (not our own fly-to); moveend = any change of view
function WatchMap({ onDrag, onView }) {
  const map = useMapEvents({
    dragend: (e) => { const c = e.target.getCenter(); onDrag({ lat: c.lat, lon: c.lng }); },
    moveend: (e) => { const m = e.target; const b = m.getBounds(); onView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), zoom: m.getZoom(), lat: m.getCenter().lat, lon: m.getCenter().lng }); }
  });
  useEffect(() => { const b = map.getBounds(); onView({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), zoom: map.getZoom(), lat: map.getCenter().lat, lon: map.getCenter().lng }); }, []); // eslint-disable-line
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
  const [progress, setProgress] = useState({ steps: {}, sources: [] });
  const [mapCenter, setMapCenter] = useState(null); // last place the user dragged the map to
  const [popupHidden, setPopupHidden] = useState(false);
  const [view, setView] = useState(null);           // visible map box
  const [nearby, setNearby] = useState({ status: 'idle', items: [] });
  const [listTab, setListTab] = useState('picks');
  const [active, setActive] = useState(null);
  const [me, setMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [onlyTrusted, setOnlyTrusted] = useState(false);
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
    setProgress({ steps: {}, sources: [] });
    setActive(null);
    setPopupHidden(false);
    setMapCenter(null);
    const onEvent = (ev) => setProgress((p) => {
      if (ev.type === 'step') return { ...p, steps: { ...p.steps, [ev.id]: ev } };
      if (ev.type === 'sources') return { ...p, sources: ev.sources || [] };
      return p;
    });
    try {
      setState(await getDiscover(cat, lat, lon, { place: name, refresh, onEvent }));
    } catch {
      setState({ status: 'error', message: 'Could not reach Wanderpin. Check your connection.' });
    }
  };

  useEffect(() => { load(); }, [cat, lat, lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // "More nearby": all matching places in the visible part of the map
  useEffect(() => {
    if (!view) return;
    if (view.zoom < 12) { setNearby({ status: 'zoom', items: [] }); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setNearby((n) => ({ ...n, status: 'loading' }));
      try {
        const items = await getAreaPlaces(cat, view);
        if (alive) setNearby({ status: 'ok', items });
      } catch (e) { if (alive) setNearby({ status: 'error', items: [], message: e.message }); }
    }, 700);
    return () => { alive = false; clearTimeout(t); };
  }, [view?.s, view?.w, view?.n, view?.e, view?.zoom, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  const locateMe = async () => {
    setLocating(true);
    try {
      const pos = await getMyLocation();
      setMe({ ...pos, t: Date.now() });
      if (lat == null) {
        const where = await reverseGeocode(pos.lat, pos.lon);
        setPlace({ ...pos, name: where.name });
      }
    } catch { alert('Location is off. Allow location access, or search a city instead.'); } finally { setLocating(false); }
  };

  const items = state.items || [];
  const center = lat != null ? { lat, lon } : null;
  const sameCell = (a, b) => { const x = cellOf(a.lat, a.lon), y = cellOf(b.lat, b.lon); return x.i === y.i && x.j === y.j; };
  const moved = !!(mapCenter && center && !sameCell(mapCenter, center)) && state.status !== 'loading';
  const age = state.updatedAt ? Date.now() - state.updatedAt : 0;
  const canRefresh = age > REFRESH_DAYS * 86400000;
  const label = DISCOVER_CATS[cat].label;
  const area = state.area || name;

  const numbered = useMemo(() => items.map((it, i) => ({ ...it, n: i + 1, dist: center ? distanceKm(center.lat, center.lon, it.lat, it.lon) : null })), [items]); // eslint-disable-line
  const trustedCount = numbered.filter((i) => i.trusted).length;
  const shown = onlyTrusted ? numbered.filter((i) => i.trusted) : numbered;
  const pickNames = new Set(numbered.map((i) => i.name.toLowerCase()));
  const more = (nearby.items || []).filter((p) => !pickNames.has(p.name.toLowerCase()))
    .map((p) => ({ ...p, dist: view ? distanceKm(view.lat, view.lon, p.lat, p.lon) : null }))
    .sort((a, b) => (b.famous - a.famous) || (a.dist - b.dist));

  const focus = (it) => {
    setActive(it);
    listRefs.current[it.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const searchHere = async () => {
    const where = await reverseGeocode(mapCenter.lat, mapCenter.lon);
    setPlace({ ...mapCenter, name: where.name });
    setMapCenter(null);
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

      <LocationPicker current={area} onPick={(p) => setPlace(p)} onLocate={locateMe} locating={locating} />

      {state.status === 'need_place' && (
        <div className="empty card" style={{ padding: 32 }}>
          <Icon name="pin" size={32} />
          <b style={{ fontSize: 18, color: 'var(--ink)' }}>Where should we look for {label.toLowerCase()}?</b>
          <div>Use your location or search a city above, like Lucknow, Goa or Manali.</div>
          <button className="btn accent" onClick={locateMe} disabled={locating}><Icon name="locate" size={18} />{locating ? 'Finding you…' : 'Use my location'}</button>
        </div>
      )}

      {center && (
        <div className="discover-layout">
          <div className="discover-map">
            <MapBoundary>
              <MapContainer center={[center.lat, center.lon]} zoom={12} scrollWheelZoom={desktop} zoomControl={desktop} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Recenter center={center} />
                <WatchMap onDrag={(c) => { setMapCenter(c); setPopupHidden(false); }} onView={setView} />
                <FlyTo target={active} />
                <FlyTo target={me} zoom={13} />
                <Circle center={[cellOf(lat, lon).center.lat, cellOf(lat, lon).center.lon]} radius={11000}
                  pathOptions={{ color: '#B5694A', weight: 1, fillOpacity: 0.04, dashArray: '4 6' }} />
                {me && <CircleMarker center={[me.lat, me.lon]} radius={8} pathOptions={{ color: '#FFFDF9', weight: 3, fillColor: '#2F6FEB', fillOpacity: 1 }} />}
                {more.map((p) => (
                  <CircleMarker key={p.id} center={[p.lat, p.lon]} radius={5}
                    pathOptions={{ color: '#FFFDF9', weight: 1.5, fillColor: '#6B5E52', fillOpacity: .85 }}>
                    <Popup>
                      <div style={{ fontFamily: 'var(--sans)', minWidth: 160 }}>
                        <b style={{ fontSize: 14 }}>{p.name}</b>
                        <div style={{ fontSize: 12, color: '#6B5E52', margin: '2px 0 8px' }}>{[p.kind, p.cuisine].filter(Boolean).join(' · ')}</div>
                        <a href={mapsLink(p)} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700 }}>Directions</a>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                {shown.map((it) => (
                  <Marker key={it.id} position={[it.lat, it.lon]} icon={pin(it.n, active?.id === it.id, it.trusted)}
                    eventHandlers={{ click: () => focus(it) }} title={it.name} zIndexOffset={it.trusted ? 100 : 0} />
                ))}
              </MapContainer>
            </MapBoundary>

            {moved && !popupHidden && (
              <div className="map-popup" role="dialog" aria-label="Search this area">
                <span style={{ fontSize: 13, opacity: .85 }}>New area</span>
                <button className="btn accent" style={{ height: 38, padding: '0 14px' }} onClick={searchHere}><Icon name="search" size={16} />Search this area</button>
                <button className="icon-btn" style={{ width: 32, height: 32, border: 'none', background: 'transparent', color: 'var(--paper)' }} aria-label="Dismiss" onClick={() => setPopupHidden(true)}><Icon name="close" size={16} /></button>
              </div>
            )}

            <button className="map-locate" onClick={locateMe} aria-label="Show my location" disabled={locating}>
              <Icon name="locate" size={20} className={locating ? 'spin' : ''} />
            </button>
            <div className="map-legend">
              <span><b style={{ color: '#E9C46A' }}>★</b> Trusted</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, border: '1.5px solid var(--ink)', background: 'var(--paper)' }} /> Less known</span>
              <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#6B5E52' }} /> More nearby</span>
            </div>
            {view && (
              <a className="map-gmaps" href={googleMapsSearch(cat, view.lat, view.lon, Math.round(view.zoom))} target="_blank" rel="noreferrer">
                <img src={favicon('maps.google.com')} alt="" width="16" height="16" />See more on Google Maps
              </a>
            )}
          </div>

          <div className="discover-list">
            {state.status === 'loading' && <SearchingPanel label={label} area={area} progress={progress} />}

            {state.status === 'ok' && (
              <>
                <div className="row wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 24 }}>{label} in {area}</h2>
                    <div className="sub" style={{ fontSize: 13 }}>
                      {state.mode === 'web' ? 'AI picks from across the web' : state.ai ? 'AI picks' : 'Popular places from OpenStreetMap'} · {ageLabel(state.updatedAt)}
                      {state.searches > 1 ? ` · searched ${state.searches} times` : ''}
                    </div>
                  </div>
                  {canRefresh && <button className="chip row" style={{ gap: 6 }} onClick={() => load(true)}><Icon name="clock" size={16} />Refresh picks</button>}
                </div>

                {state.sources?.length > 0 && <SourcesStrip sources={state.sources} />}

                <div className="seg" role="tablist">
                  <button role="tab" aria-selected={listTab === 'picks'} className={listTab === 'picks' ? 'on' : ''} onClick={() => setListTab('picks')}>AI picks · {numbered.length}</button>
                  <button role="tab" aria-selected={listTab === 'nearby'} className={listTab === 'nearby' ? 'on' : ''} onClick={() => setListTab('nearby')}>
                    More nearby · {nearby.status === 'loading' ? '…' : more.length}
                  </button>
                </div>

                {listTab === 'nearby' ? <NearbyList state={nearby} items={more} cat={cat} area={area} gmaps={view ? googleMapsSearch(cat, view.lat, view.lon, Math.round(view.zoom)) : null} /> : <>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className={`chip ${!onlyTrusted ? 'on' : ''}`} onClick={() => setOnlyTrusted(false)}>All {numbered.length}</button>
                  <button className={`chip row ${onlyTrusted ? 'on' : ''}`} style={{ gap: 6 }} onClick={() => setOnlyTrusted(true)} disabled={!trustedCount}>
                    <span style={{ color: '#E9C46A' }}>★</span> Trusted only {trustedCount}
                  </button>
                </div>

                <div className="list single">
                  {shown.map((it) => <PickCard key={it.id} it={it} cat={cat} area={area} active={active?.id === it.id}
                    setRef={(el) => { listRefs.current[it.id] = el; }} onClick={() => setActive(it)} />)}
                </div>

                <TrustNote />
                </>}
                {state.entryPoint && <SearchSuggestions html={state.entryPoint} />}
                <div className="sub" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  Shared with every Wanderpin traveller searching this area and refreshed monthly. Always check opening hours before you go.
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

function SearchingPanel({ label, area, progress }) {
  const real = progress.sources || [];
  const logos = real.length ? real.slice(0, 12).map((s) => ({ domain: s.domain, label: s.domain })) : LOOKING_AT;
  return (
    <div className="card searching" aria-live="polite">
      <div className="row" style={{ gap: 14 }}>
        <Globe size={56} />
        <div>
          <b style={{ fontSize: 18 }}>Finding the best {label.toLowerCase()}{area ? ` around ${area}` : ''}</b>
          <div className="sub" style={{ fontSize: 13 }}>First search for an area takes about 15–30 seconds. After that it's instant for everyone.</div>
        </div>
      </div>

      <div className="list single" style={{ gap: 8 }}>
        {STEPS.map(([id, text]) => {
          const st = progress.steps[id];
          const done = st?.status === 'done';
          const on = st?.status === 'start';
          return (
            <div key={id} className="row" style={{ gap: 10, opacity: done || on ? 1 : .45 }}>
              <span className={`step-dot ${done ? 'done' : on ? 'on' : ''}`}>{done ? <Icon name="check" size={13} /> : null}</span>
              <span style={{ fontSize: 14 }}>{text}{done && st.count != null ? <span className="sub"> · {st.count} found</span> : ''}</span>
            </div>
          );
        })}
      </div>

      <div>
        <div className="sub" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 8 }}>
          {real.length ? `Reading ${real.length} source${real.length > 1 ? 's' : ''}` : 'Looking across'}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {logos.map((s, i) => (
            <span key={s.domain} className="source-chip pop" style={{ animationDelay: `${i * 90}ms` }} title={s.label}>
              <img src={favicon(s.domain)} alt="" width="18" height="18" loading="lazy" />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SourcesStrip({ sources }) {
  const [open, setOpen] = useState(false);
  const shown = open ? sources : sources.slice(0, 6);
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 14 }}>Pulled from {sources.length} source{sources.length > 1 ? 's' : ''}</b>
        {sources.length > 6 && <button className="linkish" style={{ fontSize: 13 }} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Show all'}</button>}
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        {shown.map((s) => (
          <a key={s.domain} href={s.url} target="_blank" rel="noreferrer" className="source-chip" title={s.title || s.domain}>
            <img src={favicon(s.domain)} alt="" width="18" height="18" loading="lazy" />
            <span>{s.domain}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function PickCard({ it, cat, area, active, setRef, onClick }) {
  const saveType = cat === 'sight' || cat === 'busy' || cat === 'quiet' ? 'sight' : cat === 'stay' ? 'stay' : cat === 'couple' ? 'couple' : cat === 'cafe' ? 'cafe' : 'food';
  return (
    <div ref={setRef} className="card" onClick={onClick}
      style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', outline: active ? '2px solid var(--ink)' : 'none', background: it.trusted ? 'var(--paper)' : '#FBF8F3' }}>
      <span style={{ position: 'relative', width: 34, height: 34, borderRadius: 17, flexShrink: 0, background: it.trusted ? 'var(--accent)' : 'var(--paper)', color: it.trusted ? 'var(--paper)' : 'var(--ink)', border: it.trusted ? 'none' : '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
        {it.n}
      </span>
      <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <b style={{ fontSize: 16 }}>{it.name}</b>
          {it.trusted
            ? <span className="tag" style={{ background: '#F6E6B8', color: '#5C4510' }}>★ Trusted</span>
            : <span className="tag" style={{ background: 'transparent', border: '1px dashed var(--line)', color: 'var(--muted)' }}>Less known</span>}
        </div>
        {it.why && <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--muted)' }}>{it.why}</div>}
        <div className="row wrap" style={{ gap: 6, marginTop: 2 }}>
          {it.bestTime && <span className="tag" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}><Icon name="clock" size={12} />{it.bestTime}</span>}
          {(it.tags || []).map((t) => <span key={t} className="tag" style={{ background: 'var(--cream)', border: '1px solid var(--line)' }}>{t}</span>)}
          {it.dist != null && <span className="sub" style={{ fontSize: 12 }}>{it.dist.toFixed(1)} km</span>}
        </div>
        {(it.sources?.length > 0 || it.inOsm) && (
          <div className="row wrap" style={{ gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            <span>Found on</span>
            {it.sources?.map((d) => <img key={d} src={favicon(d)} alt={d} title={d} width="16" height="16" style={{ borderRadius: 4 }} loading="lazy" />)}
            {it.inOsm && <img src={favicon('openstreetmap.org')} alt="OpenStreetMap" title="OpenStreetMap" width="16" height="16" style={{ borderRadius: 4 }} loading="lazy" />}
            <span>{[...(it.sources || []), it.inOsm ? 'openstreetmap.org' : null].filter(Boolean).slice(0, 2).join(', ')}{(it.sources?.length || 0) + (it.inOsm ? 1 : 0) > 2 ? ` +${(it.sources?.length || 0) + (it.inOsm ? 1 : 0) - 2}` : ''}</span>
          </div>
        )}
      </div>
      <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <a className="icon-btn" style={{ width: 40, height: 40 }} href={mapsLink(it)} target="_blank" rel="noreferrer" aria-label={`Directions to ${it.name}`}><Icon name="route" size={18} /></a>
        <SaveButton item={{ type: saveType, name: it.name, lat: it.lat, lon: it.lon, city: area, note: it.why }} size={40} />
      </div>
    </div>
  );
}

function NearbyList({ state, items, cat, area, gmaps }) {
  const saveType = cat === 'sight' || cat === 'busy' || cat === 'quiet' ? 'sight' : cat === 'stay' ? 'stay' : cat === 'couple' ? 'couple' : cat === 'cafe' ? 'cafe' : 'food';
  if (state.status === 'zoom') return <div className="empty card">Zoom in on the map to see every place in that area.</div>;
  if (state.status === 'loading' && !items.length) return <div className="card sub">Loading every place in view…</div>;
  if (state.status === 'error') return <div className="alert">{state.message}</div>;
  return (
    <>
      <div className="sub" style={{ fontSize: 13 }}>Every matching place in the visible map area, from OpenStreetMap. Move or zoom the map to update.</div>
      {!items.length && <div className="empty card">No other places in view.</div>}
      <div className="list single">
        {items.slice(0, 150).map((p) => (
          <div key={p.id} className="card item">
            <div className="grow">
              <div className="title" style={{ fontSize: 15 }}>{p.name}{p.famous ? <span className="tag" style={{ marginLeft: 8, background: 'var(--sand-soft)' }}>Well known</span> : null}</div>
              <div className="meta">{[p.cuisine || p.kind, p.dist != null ? `${p.dist.toFixed(1)} km` : null].filter(Boolean).join(' · ')}</div>
            </div>
            <a className="icon-btn" style={{ width: 40, height: 40 }} href={mapsLink(p)} target="_blank" rel="noreferrer" aria-label={`Directions to ${p.name}`}><Icon name="route" size={18} /></a>
            <SaveButton item={{ type: saveType, name: p.name, lat: p.lat, lon: p.lon, city: area, note: p.cuisine || p.kind }} size={40} />
          </div>
        ))}
      </div>
      {gmaps && <a className="btn ghost" href={gmaps} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><img src={favicon('maps.google.com')} alt="" width="18" height="18" />Still missing a place? Open this area on Google Maps</a>}
    </>
  );
}

function TrustNote() {
  return (
    <details className="card" style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--muted)' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--ink)' }}>How do we decide what's ★ Trusted?</summary>
      <div style={{ marginTop: 8 }}>
        A place is <b>Trusted</b> when several independent sources back it up: mentions across blogs, review and travel sites or Instagram found through Google, plus being a known, listed place on OpenStreetMap. <b>Less known</b> places have only one source so far. They can still be great hidden gems, just double-check before you go.
      </div>
    </details>
  );
}

// Google requires showing its search suggestions with web-grounded results
function SearchSuggestions({ html }) {
  return (
    <iframe title="Related Google searches" srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      style={{ width: '100%', height: 64, border: 'none', borderRadius: 14, background: 'transparent' }} />
  );
}

function LocationPicker({ current, onPick, onLocate, locating }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    if (q.trim().length < 2) { setResults([]); return; }
    t.current = setTimeout(async () => { try { setResults(await searchPlaces(q)); } catch { setResults([]); } }, 350);
    return () => clearTimeout(t.current);
  }, [q]);
  return (
    <div style={{ position: 'relative' }}>
      <form className="search" onSubmit={(e) => { e.preventDefault(); if (results[0]) { onPick(results[0]); setQ(''); setResults([]); } }}>
        <Icon name="pin" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={current ? `Searching around ${current}. Change city…` : 'Search a city or area, e.g. Lucknow'} aria-label="City or area" />
        <button type="button" className="icon-btn" style={{ border: 'none', background: 'var(--ink)', color: 'var(--paper)' }} onClick={onLocate} aria-label="Use my location" disabled={locating}><Icon name="locate" size={18} /></button>
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
