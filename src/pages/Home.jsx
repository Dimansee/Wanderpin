import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Scene from '../components/Scene.jsx';
import Icon from '../components/Icon.jsx';
import SearchBox, { placeUrl } from '../components/SearchBox.jsx';
import { GlobeSlot, TileArt } from '../components/bits.jsx';
import { useLiveConditions } from '../lib/useLive.js';
import { getMyLocation, reverseGeocode, localTime } from '../lib/api.js';
import { DESTINATIONS } from '../lib/destinations.js';
import { timeOfDayFromHour } from '../components/Scene.jsx';
import { useCollection } from '../lib/store.js';
import { useIsDesktop } from '../lib/useMedia.js';

const TIPS = [
  'Agree the fare or ask for the meter before you get in. A quick check saves most taxi disputes.',
  'Keep a photo of your ID and bookings offline. Signal drops when you need it most.',
  'Visit famous spots right at opening time. You get better photos and shorter queues.',
  'If a stranger says a place is "closed today" and offers a better one, check for yourself first.',
  'Carry small change for tips, temples and street food. Big notes invite "no change" excuses.',
  'Ask your hotel what a fair auto or cab fare is before heading out.',
  'Eat where locals queue. High turnover means fresher food.'
];

const MOODS = [
  { cat: 'couple', name: 'Couple spots', sub: 'Sunsets, quiet corners', h: 210 },
  { cat: 'food', name: 'Food trails', sub: 'Local must-eats', h: 160 },
  { cat: 'cafe', name: 'Cafe hopping', sub: 'Work-friendly, aesthetic', h: 160 },
  { cat: 'sight', name: 'Popular spots', sub: 'The ones everyone visits', h: 210 }
];
const MORE = [['family', 'Family dining'], ['busy', 'Busy and buzzing'], ['stay', 'Stays'], ['quiet', 'Skip the crowds']];

function greeting(t) {
  return { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Late-night planning?' }[t];
}

export default function Home() {
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const [loc, setLoc] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wanderpin:lastLoc')); } catch { return null; }
  });
  const { weather, clock, timeOfDay } = useLiveConditions(loc?.lat, loc?.lon);
  const trips = useCollection('trips');
  const saves = useCollection('saves');
  const ink = timeOfDay === 'night' ? '#FFFDF9' : '#2B2420';

  // Refresh location quietly only if the user already allowed it before
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((p) => {
      if (p.state !== 'granted') return;
      getMyLocation().then(async ({ lat, lon }) => {
        const where = await reverseGeocode(lat, lon);
        const next = { lat, lon, ...where };
        localStorage.setItem('wanderpin:lastLoc', JSON.stringify(next));
        setLoc(next);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const useLocation = async () => {
    try {
      const { lat, lon } = await getMyLocation();
      const where = await reverseGeocode(lat, lon);
      const next = { lat, lon, ...where };
      localStorage.setItem('wanderpin:lastLoc', JSON.stringify(next));
      setLoc(next);
    } catch { alert('Location is off. You can still search any place.'); }
  };

  const moodUrl = (cat) => (loc ? `/place?name=${encodeURIComponent(loc.name)}&lat=${loc.lat}&lon=${loc.lon}&tab=${cat}` : `/find?tab=${cat}`);
  const tip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Scene timeOfDay={timeOfDay} weather={weather?.kind} kind="home" height={desktop ? 580 : 470} />
        <div style={{ position: 'absolute', inset: 0 }}>
          <div className="container" style={{ height: '100%' }}>
            <div className="row" style={{ position: 'absolute', left: 20, right: 20, top: 'calc(20px + env(safe-area-inset-top))', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: desktop ? 26 : 22, fontWeight: 700, color: ink }}>Wanderpin</div>
              <div className="row">
                <Link to="/profile" className="icon-btn glass only-mobile" aria-label="Profile and settings"><Icon name="user" size={20} /></Link>
                <GlobeSlot />
              </div>
            </div>
            <div style={{ position: 'absolute', left: 20, right: 20, top: desktop ? 150 : 'calc(92px + env(safe-area-inset-top))', display: 'flex', flexDirection: 'column', gap: desktop ? 14 : 10, color: ink, maxWidth: 640 }}>
              <div style={{ fontSize: desktop ? 18 : 15, fontWeight: 500 }}>{greeting(timeOfDay)}</div>
              <h1 className="hero-title">Where to next?</h1>
              {desktop && <div style={{ fontSize: 18, lineHeight: 1.5, maxWidth: 520, opacity: .85 }}>Itineraries, cafes, couple spots, famous food, crowds and scams for any place. Or turn a travel reel into your trip.</div>}
              <div className="row wrap" style={{ marginTop: 4 }}>
                <button onClick={useLocation} className="row" style={{ height: 36, padding: '0 14px', borderRadius: 18, background: 'rgba(255,253,249,.85)', border: 'none', fontSize: 13, fontWeight: 500, gap: 6, color: 'var(--ink)' }}>
                  <Icon name="pin" size={15} /> {loc ? loc.name : 'Use my location'}
                </button>
                <div className="row" style={{ height: 36, padding: '0 14px', borderRadius: 18, background: 'rgba(255,253,249,.85)', fontSize: 13, fontWeight: 500, gap: 6, color: 'var(--ink)' }}>
                  {weather && <><Icon name={weather.kind === 'rain' ? 'rain' : weather.kind === 'cloudy' ? 'cloud' : timeOfDay === 'night' ? 'moon' : 'sun'} size={15} /> {weather.temp}° ·</>} {clock.time}
                </div>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: -28, zIndex: 5, maxWidth: desktop ? 680 : 'none' }}>
              <SearchBox />
            </div>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingTop: desktop ? 72 : 52 }}>
        <section className="section">
          <h2 style={{ fontSize: 22 }}>Start planning</h2>
          <div className="plan-grid">
            <PlanCard to="/find" icon="search" iconBg="var(--teal-soft)" iconFg="var(--teal)" title="Explore a place"
              desc="Weather, itinerary, food, cafes, couple spots and scams for any city." />
            <PlanCard to="/import" dark icon="reel" title="Plan from a reel"
              desc="Paste an Instagram reel. We pull out every place and build your days." />
            <PlanCard to="/trips/new" icon="pencil" iconBg="var(--plum-soft)" iconFg="var(--plum)" title="Build my own trip"
              desc="A day-by-day planner with your saved spots, notes and timings." />
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 22 }}>Trending destinations</h2>
              <div className="sub">Live scenes in each place's local time</div>
            </div>
            <Link to="/find" style={{ fontSize: 14, fontWeight: 500 }}>Search all</Link>
          </div>
          <div className="dest-grid">
            {DESTINATIONS.map((d) => <DestCard key={d.name} d={d} />)}
          </div>
        </section>

        <section className="section">
          <div>
            <h2 style={{ fontSize: 22 }}>What's the mood?</h2>
            <div className="sub">{loc ? `Spots around ${loc.name}, or search anywhere` : 'Pick a vibe, then choose where'}</div>
          </div>
          <div className="masonry">
            <div>{[MOODS[0], MOODS[2]].map((m) => <MoodTile key={m.cat} m={desktop ? { ...m, h: 260 } : m} onClick={() => nav(moodUrl(m.cat))} />)}</div>
            <div>{[MOODS[1], MOODS[3]].map((m) => <MoodTile key={m.cat} m={desktop ? { ...m, h: 260 } : m} onClick={() => nav(moodUrl(m.cat))} />)}</div>
          </div>
          <div className="row wrap">
            {MORE.map(([cat, label]) => <button key={cat} className="chip" onClick={() => nav(moodUrl(cat))}>{label}</button>)}
          </div>
        </section>

        <section className="reel-strip">
          <div className="reel-strip-head">
            <span className="tag" style={{ background: 'var(--accent)', color: 'var(--paper)' }}>New</span>
            <h2 style={{ fontSize: 26, color: 'var(--paper)' }}>From reel to real trip</h2>
            <div style={{ fontSize: 14, opacity: .8, lineHeight: 1.5 }}>Saw an itinerary on Instagram? Don't screenshot it. Plan it.</div>
            <Link to="/import" className="btn accent" style={{ textDecoration: 'none', alignSelf: 'flex-start', marginTop: 6 }}><Icon name="reel" size={18} />Try it now</Link>
          </div>
          <div className="reel-steps">
            {[['link', 'Share or paste', 'Send any reel from Instagram, or paste its link.'],
              ['search', 'We read it', 'Places, cafes, food and tips mentioned are picked out.'],
              ['map', 'Your itinerary', 'Day-by-day plan you can edit, save and share.']].map(([ic, t, d], i) => (
              <div key={t} className="reel-step">
                <span className="reel-step-num">{i + 1}</span>
                <Icon name={ic} />
                <b style={{ fontSize: 15 }}>{t}</b>
                <span style={{ fontSize: 13, opacity: .8, lineHeight: 1.45 }}>{d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 style={{ fontSize: 22 }}>Travel smart</h2>
          <div className="tools-grid">
            <Tool to="/find?tab=scams" icon="warn" color="#8A2E1C" title="Scam alerts" sub="Common tricks by city" />
            <Tool to={moodUrl('busy')} icon="people" color="#2F5E55" title="Crowd check" sub="Best time to go" />
            <Tool to="/find?tab=overview" icon="cloud" color="#8A6A1C" title="Weather and time" sub="Anywhere, right now" />
            <Tool to="/packing" icon="bag" color="#6E3C72" title="Packing list" sub="Ticks off as you pack" />
          </div>
        </section>

        <div className="two-col">
        <section className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-head"><h2 style={{ fontSize: 20 }}>Your travel space</h2><Link to="/saved" style={{ fontSize: 14, fontWeight: 500 }}>Open</Link></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <Space to="/trips" icon="map" bg="var(--accent-soft)" fg="var(--accent-ink)" label="Trips" n={trips.length} />
            <Space to="/saved?tab=notes" icon="note" bg="var(--teal-soft)" fg="var(--teal)" label="Notes" />
            <Space to="/saved?tab=food" icon="food" bg="var(--sand-soft)" fg="#7A5A12" label="Food list" n={saves.filter((s) => ['food', 'dish', 'family', 'cafe'].includes(s.type)).length} />
            <Space to="/saved?tab=wishlist" icon="pin" bg="var(--plum-soft)" fg="var(--plum)" label="Wishlist" n={saves.filter((s) => s.type === 'wishlist').length} />
          </div>
        </section>

        <div className="alert tip">
          <Icon name="bulb" style={{ flexShrink: 0 }} />
          <div><b style={{ fontSize: 15 }}>Tip of the day</b><div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{tip}</div></div>
        </div>
        </div>

        <footer className="footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>Wanderpin</div>
            <div className="sub" style={{ fontSize: 13 }}>Plan smarter trips. Find the good spots. Skip the scams.</div>
          </div>
          <div className="row wrap" style={{ gap: 16, fontSize: 14 }}>
            <Link to="/find">Explore</Link><Link to="/import">Reel to trip</Link><Link to="/trips">Trips</Link><Link to="/saved">Saved</Link><Link to="/packing">Packing list</Link>
          </div>
          <div className="sub" style={{ fontSize: 12 }}>Guides: Wikivoyage (CC BY-SA) · Places: © OpenStreetMap contributors · Weather: Open-Meteo</div>
        </footer>
      </div>
    </div>
  );
}

function PlanCard({ to, icon, iconBg, iconFg, title, desc, dark }) {
  return (
    <Link to={to} className={`plan-card ${dark ? 'dark' : ''}`}>
      <span className="plan-icon" style={dark ? { background: 'var(--accent)', color: 'var(--paper)' } : { background: iconBg, color: iconFg }}><Icon name={icon} size={20} /></span>
      <b className="plan-title">{title}</b>
      <span className="plan-desc">{desc}</span>
      <span className="plan-go"><Icon name="chevron" size={18} /></span>
    </Link>
  );
}

function DestCard({ d }) {
  const { time, hour } = localTime(d.tz);
  return (
    <Link to={placeUrl(d)} className="dest-card">
      <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }}>
        <Scene kind={d.kind} timeOfDay={timeOfDayFromHour(hour)} height={150} />
        <span className="tag" style={{ position: 'absolute', left: 10, top: 10 }}><Icon name="clock" size={13} />{time}</span>
      </div>
      <div style={{ padding: '10px 4px 2px' }}>
        <b style={{ fontSize: 16 }}>{d.name}</b>
        <div className="sub" style={{ fontSize: 13 }}>{d.tag}</div>
      </div>
    </Link>
  );
}

function MoodTile({ m, onClick }) {
  return (
    <button onClick={onClick} style={{ border: 'none', padding: 0, background: 'none', textAlign: 'left' }} aria-label={m.name}>
      <div style={{ position: 'relative', pointerEvents: 'none' }}>
        <PinTileStatic cat={m.cat} h={m.h} />
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 10, background: 'var(--paper)', borderRadius: 14, padding: '8px 10px' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.sub}</div>
        </div>
      </div>
    </button>
  );
}

function PinTileStatic({ cat, h }) {
  return <TileArt cat={cat} height={h} radius={20} />;
}

function Tool({ to, icon, color, title, sub }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: `${color}1A`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} /></span>
      <div><div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div><div style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</div></div>
    </Link>
  );
}

function Space({ to, icon, bg, fg, label, n }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Icon name={icon} />
        {n > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, background: 'var(--ink)', color: 'var(--paper)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{n}</span>}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
    </Link>
  );
}
