import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Globe from './Globe.jsx';
import { useSaved, useToast } from '../lib/store.js';
import { mapsLink, CATEGORIES } from '../lib/api.js';

export function TopBar({ title, back = true, right }) {
  const nav = useNavigate();
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
      {back && (
        <button className="icon-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}><Icon name="back" size={20} /></button>
      )}
      {title ? <h1 className="grow" style={{ fontSize: back ? 22 : 32 }}>{title}</h1> : <span className="grow" />}
      <div className="row">
        {right}
        <GlobeSlot />
      </div>
    </div>
  );
}

export function GlobeSlot() {
  return (
    <div data-globe-slot style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Globe size={40} />
    </div>
  );
}

export function SaveButton({ item, label = 'Save', glass, size = 44 }) {
  const [saved, toggle] = useSaved(item);
  const toast = useToast();
  return (
    <button
      className={`icon-btn ${saved ? 'saved' : glass ? 'glass' : ''}`}
      style={{ width: size, height: size }}
      aria-label={saved ? `Remove ${item.name} from saved` : `${label} ${item.name}`}
      aria-pressed={saved}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); toast(saved ? 'Removed from saved' : 'Saved to your travel space'); }}
    >
      <Icon name="bookmark" size={18} />
    </button>
  );
}

const MOTIFS = {
  couple: (c) => <><circle cx="110" cy="60" r="26" fill="#F7D6C9" /><rect x="0" y="120" width="170" height="80" fill={c} /><circle cx="62" cy="108" r="9" fill="#5A2A2E" /><circle cx="84" cy="108" r="9" fill="#5A2A2E" /><path d="M52 140 q10 -26 20 0z M74 140 q10 -26 20 0z" fill="#5A2A2E" /></>,
  cafe: () => <><path d="M30 40 h70 v44 a35 35 0 0 1 -70 0z" fill="#FFFDF9" /><path d="M100 52 h12 a12 12 0 0 1 0 24 h-12" fill="none" stroke="#FFFDF9" strokeWidth="6" /><path d="M50 18 q6 8 0 14 M72 18 q6 8 0 14" fill="none" stroke="#5E7A55" strokeWidth="3" strokeLinecap="round" /></>,
  food: () => <><ellipse cx="85" cy="90" rx="60" ry="22" fill="#FFFDF9" /><circle cx="62" cy="78" r="15" fill="#B5694A" /><circle cx="96" cy="74" r="17" fill="#B5694A" /><circle cx="118" cy="84" r="9" fill="#8A4630" /></>,
  family: () => <><ellipse cx="85" cy="90" rx="60" ry="22" fill="#FFFDF9" /><circle cx="70" cy="80" r="14" fill="#C9725A" /><circle cx="102" cy="80" r="14" fill="#E9C46A" /></>,
  sight: (c) => <><rect x="30" y="50" width="110" height="80" rx="6" fill={c} /><path d="M30 50 l55 -26 l55 26z" fill="#5E7A55" /><rect x="72" y="90" width="24" height="40" fill="#F5EFE6" /></>,
  stay: () => <><rect x="35" y="40" width="100" height="90" rx="6" fill="#FFFDF9" /><g fill="#C9B79C">{[50, 74, 98].map((x) => [56, 82].map((y) => <rect key={x + '-' + y} x={x} y={y} width="16" height="14" rx="2" />))}</g></>,
  busy: () => <><g fill="#8A4630">{[40, 70, 100, 130].map((x, i) => <g key={x}><circle cx={x} cy={70 + (i % 2) * 8} r="10" /><rect x={x - 10} y={84 + (i % 2) * 8} width="20" height="40" rx="10" /></g>)}</g></>,
  dish: () => <><ellipse cx="85" cy="90" rx="56" ry="20" fill="#FFFDF9" /><ellipse cx="85" cy="82" rx="34" ry="12" fill="#E3A24E" /></>
};
const TONES = { couple: ['#E8A3A0', '#C77775'], cafe: ['#C7D3C0', '#8FA585'], food: ['#E9C46A', '#B5694A'], family: ['#F2C9A0', '#C9725A'], sight: ['#C9D3E3', '#8FA585'], stay: ['#DCD3C3', '#C9B79C'], busy: ['#F2B9A0', '#C9725A'], dish: ['#F6D7B0', '#E3A24E'] };

export function TileArt({ cat, height, radius = 18 }) {
  const [bg, c2] = TONES[cat] || TONES.sight;
  const motif = MOTIFS[cat] || MOTIFS.sight;
  return (
    <div style={{ height, borderRadius: radius, background: bg, overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox={`0 0 170 ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">{motif(c2)}</svg>
    </div>
  );
}

export function PinTile({ item, height = 180, badge, onClick }) {
  const cat = item.cat || item.type || 'sight';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div onClick={onClick} style={{ height, borderRadius: 18, position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default' }}>
        <TileArt cat={cat} height={height} />
        {badge && <span className={`tag ${badge.dark ? 'dark' : ''}`} style={{ position: 'absolute', left: 10, bottom: 10 }}>{badge.text}</span>}
        <div style={{ position: 'absolute', right: 8, top: 8 }}><SaveButton item={toSave(item)} glass size={40} /></div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{item.name}</div>
    </div>
  );
}

export function toSave(item, city) {
  return {
    type: item.type || item.cat || 'place', name: item.name, lat: item.lat ?? null, lon: item.lon ?? null,
    city: item.city || city || null, note: item.note || item.desc || item.cuisine || null
  };
}

export function PlaceRow({ item, city, crowd, extra }) {
  const cat = CATEGORIES[item.cat] || CATEGORIES.sight;
  const meta = [item.cuisine, item.kindLabel && !item.cuisine ? item.kindLabel.replace(/_/g, ' ') : null, item.dist != null ? `${item.dist.toFixed(1)} km` : null].filter(Boolean).join(' · ');
  return (
    <div className="card item">
      <div className="thumb" style={{ background: cat.tone }}><Icon name={cat.icon} /></div>
      <div className="grow">
        <div className="title">{item.name}</div>
        {(meta || item.desc) && <div className="meta">{meta || item.desc}</div>}
        {item.hours && <div className="meta" style={{ fontSize: 12 }}>{item.hours}</div>}
        {extra}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {crowd && <span style={{ fontSize: 12, fontWeight: 700, color: crowd === 'Busy' ? '#8A2E1C' : crowd === 'Moderate' ? '#8A6A1C' : '#2F5E55' }}>{crowd}</span>}
        <div className="row" style={{ gap: 6 }}>
          <a className="icon-btn" style={{ width: 40, height: 40 }} href={mapsLink({ ...item, city })} target="_blank" rel="noreferrer" aria-label={`Directions to ${item.name}`}><Icon name="route" size={18} /></a>
          <SaveButton item={toSave(item, city)} size={40} />
        </div>
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22 }}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ h = 80, n = 3 }) {
  return <div className="list">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}</div>;
}
