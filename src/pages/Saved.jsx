import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopBar, Sheet, PlaceRow } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { useCollection, addItem, updateItem, removeItem, useToast } from '../lib/store.js';

const TABS = [
  ['all', 'All'], ['places', 'Places to visit'], ['food', 'Food'], ['cafe', 'Cafes'], ['couple', 'Couple spots'], ['wishlist', 'Wishlist'], ['notes', 'Notes']
];
const MATCH = {
  all: () => true,
  places: (s) => ['sight', 'place', 'busy'].includes(s.type),
  food: (s) => ['food', 'dish', 'family'].includes(s.type),
  cafe: (s) => s.type === 'cafe',
  couple: (s) => s.type === 'couple',
  wishlist: (s) => s.type === 'wishlist'
};

export default function Saved() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'all';
  const saves = useCollection('saves');
  const notes = useCollection('notes');
  const [editing, setEditing] = useState(null);

  const list = tab === 'notes' ? [] : saves.filter(MATCH[tab] || MATCH.all);
  const byCity = list.reduce((m, s) => { const k = s.city || 'Other'; (m[k] ||= []).push(s); return m; }, {});

  return (
    <div className="page">
      <TopBar title="Saved" back={false} />
      <div className="chips">
        {TABS.map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setParams({ tab: k }, { replace: true })}>{l}</button>)}
      </div>

      {tab === 'notes' ? (
        <section className="section">
          <button className="btn accent" onClick={() => setEditing({ title: '', body: '', city: '' })}><Icon name="plus" size={18} />New note</button>
          {notes.length === 0 && <Empty icon="note" text="Jot down hotel numbers, bargain prices, a cafe a friend told you about." />}
          <div className="list">
            {notes.map((n) => (
              <button key={n.id} className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={() => setEditing(n)}>
                <b style={{ fontSize: 16 }}>{n.title || 'Untitled note'}</b>
                {n.city && <span className="sub" style={{ fontSize: 13 }}>{n.city}</span>}
                <span style={{ fontSize: 14, color: 'var(--muted)', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body}</span>
              </button>
            ))}
          </div>
          <NoteSheet note={editing} onClose={() => setEditing(null)} />
        </section>
      ) : list.length === 0 ? (
        <Empty icon="bookmark" text="Tap the bookmark on any place, cafe, dish or spot and it lands here." />
      ) : (
        Object.entries(byCity).map(([city, items]) => (
          <section key={city} className="section">
            <h2>{city}</h2>
            <div className="list">
              {items.map((s) => s.type === 'dish' ? (
                <div key={s.id} className="card item">
                  <div className="thumb" style={{ background: 'var(--sand-soft)' }}><Icon name="food" /></div>
                  <div className="grow"><div className="title">{s.name}</div><div className="meta">Dish to try</div></div>
                  <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => removeItem('saves', s.id)}><Icon name="trash" size={18} /></button>
                </div>
              ) : (
                <PlaceRow key={s.id} item={{ ...s, cat: s.type === 'wishlist' ? 'sight' : s.type, desc: s.note }} city={s.city} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Empty({ icon, text }) {
  return <div className="empty"><Icon name={icon} size={32} /><div>{text}</div></div>;
}

function NoteSheet({ note, onClose }) {
  const [draft, setDraft] = useState(null);
  const toast = useToast();
  const n = draft && draft._for === note ? draft : note ? { ...note, _for: note } : null;
  const set = (k, v) => setDraft({ ...n, [k]: v });
  if (!note) return null;
  const save = async () => {
    const { _for, id, createdAt, ...data } = n;
    if (id) await updateItem('notes', id, data); else await addItem('notes', data);
    toast('Note saved'); setDraft(null); onClose();
  };
  return (
    <Sheet open onClose={() => { setDraft(null); onClose(); }} title={note.id ? 'Edit note' : 'New note'}>
      <input className="field" placeholder="Title" value={n.title} onChange={(e) => set('title', e.target.value)} aria-label="Note title" />
      <input className="field" placeholder="City (optional)" value={n.city || ''} onChange={(e) => set('city', e.target.value)} aria-label="City" />
      <textarea className="field" style={{ minHeight: 180 }} placeholder="Write anything…" value={n.body} onChange={(e) => set('body', e.target.value)} aria-label="Note" />
      <div className="row">
        <button className="btn accent grow" onClick={save}>Save note</button>
        {note.id && <button className="icon-btn" aria-label="Delete note" onClick={async () => { await removeItem('notes', note.id); setDraft(null); onClose(); }}><Icon name="trash" size={18} /></button>}
      </div>
    </Sheet>
  );
}
