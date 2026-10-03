import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar, Sheet } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { useCollection, addItem, updateItem, removeItem, useToast } from '../lib/store.js';
import { searchPlaces, mapsLink } from '../lib/api.js';
import { placeUrl } from '../components/SearchBox.jsx';

const SOURCE = { reel: 'From a reel', generated: 'Suggested plan', custom: 'My own plan' };

export function TripsList() {
  const trips = useCollection('trips');
  return (
    <div className="page">
      <TopBar title="Trips" back={false} />
      <div className="row">
        <Link to="/trips/new" className="btn accent grow" style={{ textDecoration: 'none' }}><Icon name="pencil" size={18} />Build my own trip</Link>
        <Link to="/import" className="btn ghost" style={{ textDecoration: 'none' }}><Icon name="reel" size={18} />From reel</Link>
      </div>
      {trips.length === 0 ? (
        <div className="empty"><Icon name="map" size={32} /><div>No trips yet. Save a suggested plan from any place, turn a reel into a trip, or build your own.</div></div>
      ) : (
        <div className="list">
          {trips.map((t) => (
            <Link key={t.id} to={`/trips/${t.id}`} className="card item" style={{ textDecoration: 'none' }}>
              <div className="thumb" style={{ background: t.source === 'reel' ? 'var(--accent-soft)' : 'var(--teal-soft)' }}><Icon name={t.source === 'reel' ? 'reel' : 'map'} /></div>
              <div className="grow">
                <div className="title">{t.title}</div>
                <div className="meta">{[t.destination, `${t.days?.length || 0} day${t.days?.length === 1 ? '' : 's'}`, SOURCE[t.source]].filter(Boolean).join(' · ')}</div>
              </div>
              <Icon name="chevron" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TripDetail() {
  const { id } = useParams();
  const isNew = id === 'new';
  const trips = useCollection('trips');
  const stored = trips.find((t) => t.id === id);
  const [trip, setTrip] = useState(isNew ? { title: '', destination: '', days: [{ title: 'Day 1', stops: [] }], notes: '', source: 'custom' } : null);
  const [adding, setAdding] = useState(null); // day index
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => { if (stored && !trip) setTrip(stored); }, [stored, trip]);
  if (!trip) return <div className="page"><TopBar /><div className="sub">Loading trip…</div></div>;

  const persist = async (next) => {
    setTrip(next);
    if (isNew) return;
    const { id: _id, createdAt, ...data } = next;
    await updateItem('trips', id, data);
  };
  const createNew = async () => {
    if (!trip.title.trim() && !trip.destination.trim()) { toast('Give your trip a name or destination'); return; }
    const newId = await addItem('trips', { ...trip, title: trip.title || `${trip.destination} trip` });
    toast('Trip created'); nav(`/trips/${newId}`, { replace: true });
  };
  const setDay = (i, day) => persist({ ...trip, days: trip.days.map((d, j) => (j === i ? day : d)) });
  const moveStop = (di, si, dir) => {
    const stops = [...trip.days[di].stops];
    const to = si + dir;
    if (to < 0 || to >= stops.length) return;
    [stops[si], stops[to]] = [stops[to], stops[si]];
    setDay(di, { ...trip.days[di], stops });
  };

  return (
    <div className="page">
      <TopBar right={!isNew && (
        <button className="icon-btn" aria-label="Delete trip" onClick={async () => {
          if (!confirm('Delete this trip?')) return;
          await removeItem('trips', id); nav('/trips', { replace: true });
        }}><Icon name="trash" size={18} /></button>
      )} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="field" aria-label="Trip name" value={trip.title} placeholder="Trip name, e.g. Goa with friends"
          onChange={(e) => setTrip({ ...trip, title: e.target.value })} onBlur={() => persist(trip)}
          style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, border: 'none', background: 'transparent', padding: 0 }} />
        <div className="row">
          <Icon name="pin" size={18} />
          <input className="field grow" aria-label="Destination" value={trip.destination || ''} placeholder="Destination"
            onChange={(e) => setTrip({ ...trip, destination: e.target.value })} onBlur={() => persist(trip)} />
          {trip.destination && <OpenPlace name={trip.destination} lat={trip.lat} lon={trip.lon} />}
        </div>
        {trip.reelUrl && <a href={trip.reelUrl} target="_blank" rel="noreferrer" className="sub row" style={{ gap: 6 }}><Icon name="reel" size={16} />Original reel</a>}
      </div>

      {trip.days.map((day, di) => (
        <section key={di} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <input aria-label={`Day ${di + 1} title`} value={day.title} onChange={(e) => setDay(di, { ...day, title: e.target.value })}
              style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, border: 'none', background: 'transparent', minWidth: 0, flex: 1 }} />
            {trip.days.length > 1 && <button className="icon-btn" style={{ width: 40, height: 40 }} aria-label={`Remove ${day.title}`} onClick={() => persist({ ...trip, days: trip.days.filter((_, j) => j !== di) })}><Icon name="trash" size={16} /></button>}
          </div>
          {day.stops.length === 0 && <div className="sub">No stops yet.</div>}
          {day.stops.map((s, si) => (
            <div key={si} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, marginTop: 6, background: ['var(--accent)', '#E8A3A0', '#E9C46A', '#7FA6A3'][si % 4], flexShrink: 0 }} />
              <div className="grow">
                {s.time && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.time}</div>}
                <a href={mapsLink({ ...s, city: trip.destination })} target="_blank" rel="noreferrer" style={{ fontWeight: 700, textDecoration: 'none' }}>{s.name}</a>
                {s.note && <div className="sub" style={{ fontSize: 13, lineHeight: 1.4 }}>{s.note}</div>}
              </div>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" style={{ width: 36, height: 36, border: 'none' }} aria-label="Move up" onClick={() => moveStop(di, si, -1)}><Icon name="chevron" size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="icon-btn" style={{ width: 36, height: 36, border: 'none' }} aria-label="Move down" onClick={() => moveStop(di, si, 1)}><Icon name="chevron" size={16} style={{ transform: 'rotate(90deg)' }} /></button>
                <button className="icon-btn" style={{ width: 36, height: 36, border: 'none' }} aria-label={`Remove ${s.name}`} onClick={() => setDay(di, { ...day, stops: day.stops.filter((_, j) => j !== si) })}><Icon name="close" size={16} /></button>
              </div>
            </div>
          ))}
          <button className="btn ghost" onClick={() => setAdding(di)}><Icon name="plus" size={18} />Add a stop</button>
        </section>
      ))}

      <button className="btn ghost" onClick={() => persist({ ...trip, days: [...trip.days, { title: `Day ${trip.days.length + 1}`, stops: [] }] })}><Icon name="plus" size={18} />Add a day</button>

      <section className="section">
        <h2>Trip notes</h2>
        <textarea className="field" aria-label="Trip notes" value={trip.notes || ''} placeholder="Budget, bookings, who's coming…"
          onChange={(e) => setTrip({ ...trip, notes: e.target.value })} onBlur={() => persist(trip)} />
      </section>

      {isNew && <button className="btn accent" onClick={createNew}>Create trip</button>}

      <AddStopSheet open={adding !== null} onClose={() => setAdding(null)} city={trip.destination} onAdd={(stop) => {
        const di = adding;
        setDay(di, { ...trip.days[di], stops: [...trip.days[di].stops, stop] });
        setAdding(null);
      }} />
    </div>
  );
}

function OpenPlace({ name, lat, lon }) {
  const nav = useNavigate();
  const go = async () => {
    if (lat && lon) return nav(placeUrl({ name, lat, lon }));
    const r = await searchPlaces(name);
    if (r[0]) nav(placeUrl(r[0]));
  };
  return <button className="icon-btn" aria-label={`Open ${name} guide`} onClick={go}><Icon name="chevron" size={18} /></button>;
}

function AddStopSheet({ open, onClose, onAdd, city }) {
  const [name, setName] = useState('');
  const [time, setTime] = useState('Morning');
  const [note, setNote] = useState('');
  const saves = useCollection('saves');
  const fromSaved = saves.filter((s) => s.type !== 'dish' && (!city || !s.city || s.city.toLowerCase().includes(city.toLowerCase().split(' ')[0]))).slice(0, 8);
  useEffect(() => { if (open) { setName(''); setNote(''); } }, [open]);
  const add = (n = name, extra = {}) => { if (!n.trim()) return; onAdd({ name: n.trim(), time, note: note.trim() || extra.note || '', lat: extra.lat ?? null, lon: extra.lon ?? null }); };
  return (
    <Sheet open={open} onClose={onClose} title="Add a stop">
      <input className="field" aria-label="Place name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Place, cafe or activity" autoFocus />
      <div className="row wrap">{['Morning', 'Afternoon', 'Lunch', 'Evening', 'Night'].map((t) => <button key={t} className={`chip ${time === t ? 'on' : ''}`} onClick={() => setTime(t)}>{t}</button>)}</div>
      <input className="field" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
      <button className="btn accent" onClick={() => add()} disabled={!name.trim()}>Add stop</button>
      {fromSaved.length > 0 && (
        <>
          <div className="sub">Or pick from your saved places</div>
          <div className="row wrap">{fromSaved.map((s) => <button key={s.id} className="chip" onClick={() => add(s.name, s)}>{s.name}</button>)}</div>
        </>
      )}
    </Sheet>
  );
}
