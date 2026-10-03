import { useEffect, useState } from 'react';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

const DEFAULT = {
  Essentials: ['ID / passport', 'Tickets and bookings (offline copy)', 'Phone charger', 'Power bank', 'Cash in small notes', 'Cards'],
  Clothes: ['Comfortable walking shoes', 'Light jacket or shawl', 'Sleepwear', 'Something for temples (covers shoulders and knees)'],
  'Health and care': ['Medicines you take', 'Sunscreen', 'Hand sanitiser', 'Water bottle', 'Basic first aid'],
  Extras: ['Sunglasses', 'Earphones', 'Small daypack', 'Umbrella or raincoat']
};
const KEY = 'wanderpin:packing';

export default function Packing() {
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { lists: DEFAULT, done: {} }; } catch { return { lists: DEFAULT, done: {} }; }
  });
  const [newItem, setNewItem] = useState('');
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  const all = Object.values(state.lists).flat();
  const doneCount = all.filter((i) => state.done[i]).length;

  return (
    <div className="page">
      <TopBar title="Packing list" />
      <div className="card row" style={{ justifyContent: 'space-between' }}>
        <b>{doneCount} of {all.length} packed</b>
        <button className="chip" onClick={() => setState({ ...state, done: {} })}>Reset ticks</button>
      </div>
      <form className="row" onSubmit={(e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        setState({ ...state, lists: { ...state.lists, Extras: [...(state.lists.Extras || []), newItem.trim()] } });
        setNewItem('');
      }}>
        <input className="field grow" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add your own item" aria-label="New packing item" />
        <button className="icon-btn solid" aria-label="Add item"><Icon name="plus" size={20} /></button>
      </form>
      {Object.entries(state.lists).map(([group, items]) => (
        <section key={group} className="section">
          <h2>{group}</h2>
          <div className="list">
            {items.map((item) => (
              <label key={item} className="card row" style={{ gap: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!state.done[item]} onChange={() => setState({ ...state, done: { ...state.done, [item]: !state.done[item] } })}
                  style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
                <span className="grow" style={{ textDecoration: state.done[item] ? 'line-through' : 'none', color: state.done[item] ? 'var(--muted)' : 'var(--ink)' }}>{item}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
