import { Component, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { useAdmin, listPlaces, savePlace, deletePlace, listReports, deleteReport, listDiscover, updateDiscoverItems, deleteDiscover } from '../lib/admin.js';
import { DISCOVER_CATS } from '../lib/discoverConfig.js';
import { searchPlaces, mapsLink } from '../lib/api.js';
import { useToast } from '../lib/store.js';

const EMPTY = { name: '', cat: 'food', city: '', lat: '', lon: '', why: '', bestTime: '', tags: '', price: '', link: '', photo: '', trusted: true };

class MapBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="empty" style={{ height: '100%' }}>Map couldn't load. Enter latitude and longitude by hand.</div> : this.props.children; }
}

const dropPin = L.divIcon({
  className: '', iconSize: [30, 40], iconAnchor: [15, 38],
  html: '<svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 39s13-13 13-24A13 13 0 0 0 2 15c0 11 13 24 13 24z" fill="#B5694A" stroke="#FFFDF9" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#FFFDF9"/></svg>'
});

function ClickToPin({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}
function FlyTo({ to }) {
  const map = useMap();
  useEffect(() => { if (to) map.flyTo([to.lat, to.lon], Math.max(map.getZoom(), 15), { duration: .6 }); }, [to?.lat, to?.lon]); // eslint-disable-line
  return null;
}

export default function Admin() {
  const { loading, isAdmin, user } = useAdmin();
  const [tab, setTab] = useState('places');

  if (loading) return <div className="page"><TopBar title="Admin" /><div className="sub">Checking access…</div></div>;

  if (!user) {
    return (
      <div className="page">
        <TopBar title="Admin" />
        <div className="card empty" style={{ padding: 32 }}>
          <Icon name="user" size={32} />
          <b style={{ color: 'var(--ink)', fontSize: 18 }}>Sign in to open the admin panel</b>
          <Link to="/profile" className="btn accent" style={{ textDecoration: 'none' }}>Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page">
        <TopBar title="Admin" />
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 22 }}>
          <h2 style={{ fontSize: 22 }}>This account isn't an admin yet</h2>
          <div className="sub">To make <b>{user.email || 'this account'}</b> an admin, do this once in the Firebase console:</div>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14 }}>
            <li>Firestore Database → Data → <b>Start collection</b>, name it <code>admins</code>.</li>
            <li>For <b>Document ID</b>, paste your user ID below.</li>
            <li>Add any field, for example <code>name</code> (string) = your name. Save.</li>
            <li>Come back here and refresh.</li>
          </ol>
          <div className="row" style={{ gap: 8 }}>
            <code className="field" style={{ fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' }}>{user.uid}</code>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(user.uid)}>Copy</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <TopBar title="Admin panel" />
      <div className="seg" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 560 }} role="tablist">
        {[['places', 'My places'], ['reports', 'Reports'], ['picks', 'AI picks']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'places' && <PlacesAdmin uid={user.uid} />}
      {tab === 'reports' && <ReportsAdmin />}
      {tab === 'picks' && <PicksAdmin />}
    </div>
  );
}

/* ---------------- My places ---------------- */

function PlacesAdmin({ uid }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ cat: '', city: '' });
  const [find, setFind] = useState('');
  const [found, setFound] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const toast = useToast();

  const reload = async () => { try { setRows(await listPlaces()); } catch (e) { toast(e.message); setRows([]); } };
  useEffect(() => { reload(); }, []); // eslint-disable-line

  useEffect(() => {
    if (find.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => { try { setFound(await searchPlaces(find)); } catch { setFound([]); } }, 350);
    return () => clearTimeout(t);
  }, [find]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hasPos = form.lat !== '' && form.lon !== '' && Number.isFinite(+form.lat) && Number.isFinite(+form.lon);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !hasPos) { toast('Add a name and drop a pin on the map'); return; }
    setBusy(true);
    try {
      await savePlace({ ...form, tags: typeof form.tags === 'string' ? form.tags.split(',') : form.tags }, uid);
      toast(form.id ? 'Place updated' : 'Place added. Users will see it now');
      setForm({ ...EMPTY, cat: form.cat, city: form.city });
      reload();
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };

  const edit = (r) => { setForm({ ...EMPTY, ...r, tags: (r.tags || []).join(', ') }); setFlyTo({ lat: r.lat, lon: r.lon }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (r) => { if (!confirm(`Delete "${r.name}"?`)) return; await deletePlace(r.id); toast('Deleted'); reload(); };

  const shown = (rows || []).filter((r) => (!filter.cat || r.cat === filter.cat) && (!filter.city || (r.city || '').toLowerCase().includes(filter.city.toLowerCase())));
  const mapCenter = hasPos ? { lat: +form.lat, lon: +form.lon } : rows?.[0] ? { lat: rows[0].lat, lon: rows[0].lon } : { lat: 26.9124, lon: 75.7873 };

  return (
    <>
      <div className="admin-grid">
        <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 22 }}>{form.id ? 'Edit place' : 'Add a place'}</h2>
            {form.id && <button type="button" className="chip" onClick={() => setForm(EMPTY)}>Cancel edit</button>}
          </div>
          <label className="lbl">Name<input className="field" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Tunday Kababi" required /></label>
          <div className="row" style={{ gap: 10 }}>
            <label className="lbl grow">Category
              <select className="field" value={form.cat} onChange={(e) => set('cat', e.target.value)}>
                {Object.entries(DISCOVER_CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </label>
            <label className="lbl grow">City / area<input className="field" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Lucknow" /></label>
          </div>
          <label className="lbl">Why go (shown to users)<textarea className="field" style={{ minHeight: 80 }} value={form.why} onChange={(e) => set('why', e.target.value)} placeholder="Melt-in-mouth galouti kebabs, a Lucknow legend since 1905. Budget." /></label>
          <div className="row" style={{ gap: 10 }}>
            <label className="lbl grow">Best time<input className="field" value={form.bestTime} onChange={(e) => set('bestTime', e.target.value)} placeholder="Evenings" /></label>
            <label className="lbl grow">Price
              <select className="field" value={form.price} onChange={(e) => set('price', e.target.value)}>
                <option value="">—</option><option>₹</option><option>₹₹</option><option>₹₹₹</option><option>₹₹₹₹</option>
              </select>
            </label>
          </div>
          <label className="lbl">Tags (comma separated)<input className="field" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Iconic, Non-veg, Late night" /></label>
          <label className="lbl">Link (Instagram, website or Google Maps)<input className="field" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" inputMode="url" /></label>
          <label className="lbl">Photo URL (optional)<input className="field" value={form.photo} onChange={(e) => set('photo', e.target.value)} placeholder="https://" inputMode="url" /></label>
          <label className="row" style={{ gap: 10, fontSize: 14, fontWeight: 500 }}>
            <input type="checkbox" checked={form.trusted} onChange={(e) => set('trusted', e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
            Mark as ★ Trusted (Verified by Wanderpin)
          </label>
          <div className="row" style={{ gap: 10 }}>
            <label className="lbl grow">Latitude<input className="field" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="Click the map" /></label>
            <label className="lbl grow">Longitude<input className="field" value={form.lon} onChange={(e) => set('lon', e.target.value)} placeholder="Click the map" /></label>
          </div>
          <button className="btn accent" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Add place'}</button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <label className="search"><Icon name="search" size={18} />
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a place or area to jump the map" aria-label="Find on map" />
            </label>
            {found.length > 0 && (
              <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 62, zIndex: 700, padding: 6 }}>
                {found.map((r) => (
                  <button key={r.id} type="button" className="row" style={{ width: '100%', border: 'none', background: 'none', padding: 10, textAlign: 'left', gap: 10 }}
                    onClick={() => { setFlyTo({ lat: r.lat, lon: r.lon }); setForm((f) => ({ ...f, lat: r.lat.toFixed(6), lon: r.lon.toFixed(6), city: f.city || r.region.split(',')[0] })); setFind(''); setFound([]); }}>
                    <Icon name="pin" size={18} /><span><b>{r.name}</b><br /><span className="sub" style={{ fontSize: 12 }}>{r.region}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="admin-map">
            <MapBoundary>
              <MapContainer center={[mapCenter.lat, mapCenter.lon]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ClickToPin onPick={(p) => setForm((f) => ({ ...f, lat: p.lat.toFixed(6), lon: p.lon.toFixed(6) }))} />
                <FlyTo to={flyTo} />
                {(rows || []).filter((r) => r.id !== form.id).map((r) => (
                  <CircleMarker key={r.id} center={[r.lat, r.lon]} radius={6} pathOptions={{ color: '#FFFDF9', weight: 2, fillColor: '#2F5E55', fillOpacity: 1 }}
                    eventHandlers={{ click: () => edit(r) }} />
                ))}
                {hasPos && <Marker position={[+form.lat, +form.lon]} icon={dropPin} draggable
                  eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setForm((f) => ({ ...f, lat: p.lat.toFixed(6), lon: p.lng.toFixed(6) })); } }} />}
              </MapContainer>
            </MapBoundary>
          </div>
          <div className="sub" style={{ fontSize: 12 }}>Click the map to drop the pin, drag it to fine-tune. Green dots are places you already added; click one to edit it.</div>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h2>Your places · {rows ? shown.length : '…'}</h2></div>
        <div className="row wrap" style={{ gap: 8 }}>
          <select className="field" style={{ width: 'auto' }} value={filter.cat} onChange={(e) => setFilter({ ...filter, cat: e.target.value })} aria-label="Filter by category">
            <option value="">All categories</option>
            {Object.entries(DISCOVER_CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <input className="field" style={{ width: 220 }} placeholder="Filter by city" value={filter.city} onChange={(e) => setFilter({ ...filter, city: e.target.value })} aria-label="Filter by city" />
        </div>
        {rows && !shown.length && <div className="empty card">No places yet. Add your first one above.</div>}
        <div className="list">
          {shown.map((r) => (
            <div key={r.id} className="card item" style={{ alignItems: 'flex-start' }}>
              <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <b>{r.name}</b>
                  {r.trusted !== false && <span className="tag" style={{ background: '#F6E6B8' }}>★ Trusted</span>}
                </div>
                <div className="meta">{DISCOVER_CATS[r.cat]?.label} · {r.city || '—'} {r.price ? `· ${r.price}` : ''}</div>
                {r.why && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{r.why}</div>}
              </div>
              <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label={`Edit ${r.name}`} onClick={() => edit(r)}><Icon name="pencil" size={16} /></button>
              <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label={`Delete ${r.name}`} onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------- Reports ---------------- */

function ReportsAdmin() {
  const [rows, setRows] = useState(null);
  const toast = useToast();
  const reload = async () => { try { setRows(await listReports()); } catch (e) { toast(e.message); setRows([]); } };
  useEffect(() => { reload(); }, []); // eslint-disable-line
  const when = (t) => { const d = t?.toDate ? t.toDate() : t ? new Date(t) : null; return d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''; };
  return (
    <section className="section">
      <div className="section-head"><h2>User reports · {rows ? rows.length : '…'}</h2><button className="chip" onClick={reload}>Refresh</button></div>
      {rows && !rows.length && <div className="empty card">No reports. All good.</div>}
      <div className="list">
        {(rows || []).map((r) => (
          <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="row wrap" style={{ gap: 6, justifyContent: 'space-between' }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="tag dark">{r.type || 'report'}</span>
                <b>{r.reason}</b>
              </div>
              <span className="sub" style={{ fontSize: 12 }}>{when(r.createdAt)}</span>
            </div>
            {r.destination && <div style={{ fontSize: 14 }}><b>Where:</b> {r.destination}</div>}
            {r.message && <div style={{ fontSize: 14, whiteSpace: 'pre-line' }}>{r.message}</div>}
            {r.caption && <details><summary className="sub" style={{ cursor: 'pointer' }}>Caption</summary><div style={{ fontSize: 13, whiteSpace: 'pre-line' }}>{r.caption}</div></details>}
            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              {r.url && <a className="chip" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={r.url} target="_blank" rel="noreferrer">Open link</a>}
              <button className="chip" onClick={async () => { await deleteReport(r.id); setRows((x) => x.filter((y) => y.id !== r.id)); toast('Marked as resolved'); }}>
                <Icon name="check" size={14} /> Resolve
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- AI picks moderation ---------------- */

function PicksAdmin() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');
  const toast = useToast();
  const reload = async () => { try { setRows(await listDiscover()); } catch (e) { toast(e.message); setRows([]); } };
  useEffect(() => { reload(); }, []); // eslint-disable-line

  const shown = useMemo(() => (rows || []).filter((r) => !q || (r.area || '').toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const patch = async (row, items) => {
    await updateDiscoverItems(row.id, items);
    setRows((x) => x.map((y) => (y.id === row.id ? { ...y, items } : y)));
    if (open?.id === row.id) setOpen({ ...row, items });
  };

  return (
    <section className="section">
      <div className="section-head"><h2>Saved AI picks · {rows ? rows.length : '…'}</h2><button className="chip" onClick={reload}>Refresh</button></div>
      <div className="sub">Each card is one category in one ~20 km area, shared with every user. Remove wrong places, mark good ones trusted, or clear the card so it's rebuilt on the next search.</div>
      <input className="field" style={{ maxWidth: 320 }} placeholder="Filter by area, e.g. Lucknow" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by area" />
      <div className="list">
        {shown.map((r) => (
          <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
              <div>
                <b>{DISCOVER_CATS[r.cat]?.label || r.cat} · {r.area}</b>
                <div className="sub" style={{ fontSize: 12 }}>{r.items?.length || 0} places · searched {r.searches || 0} times · {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-IN') : ''}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="chip" onClick={() => setOpen(open?.id === r.id ? null : r)}>{open?.id === r.id ? 'Close' : 'Review'}</button>
                <button className="chip" onClick={async () => {
                  if (!confirm('Clear these picks? They will be rebuilt by AI on the next search.')) return;
                  await deleteDiscover(r.id); setRows((x) => x.filter((y) => y.id !== r.id)); toast('Cleared');
                }}>Clear</button>
              </div>
            </div>
            {open?.id === r.id && (
              <div className="list single" style={{ gap: 6 }}>
                {(r.items || []).map((it, i) => (
                  <div key={it.id || i} className="row" style={{ gap: 8, padding: '8px 0', borderTop: '1px solid var(--line-soft)' }}>
                    <span style={{ width: 24, textAlign: 'center', fontWeight: 700 }}>{i + 1}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <b style={{ fontSize: 14 }}>{it.name}</b> {it.trusted ? <span style={{ color: '#B08A1E' }}>★</span> : <span className="sub" style={{ fontSize: 12 }}>less known</span>}
                      <div className="sub" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.why}</div>
                    </div>
                    <a className="icon-btn" style={{ width: 36, height: 36 }} href={mapsLink(it)} target="_blank" rel="noreferrer" aria-label="Check on map"><Icon name="pin" size={15} /></a>
                    <button className="chip" style={{ height: 34 }} onClick={() => patch(r, r.items.map((x, j) => (j === i ? { ...x, trusted: !x.trusted } : x)))}>{it.trusted ? 'Untrust' : '★ Trust'}</button>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label={`Remove ${it.name}`} onClick={() => patch(r, r.items.filter((_, j) => j !== i))}><Icon name="trash" size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
