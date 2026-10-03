import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Scene from '../components/Scene.jsx';
import Icon from '../components/Icon.jsx';
import { TopBar, SaveButton, PinTile, PlaceRow, Sheet, Skeleton } from '../components/bits.jsx';
import { useLiveConditions } from '../lib/useLive.js';
import { getGuide, getNearby, detectSceneKind, estimateCrowd, buildItinerary, CATEGORIES } from '../lib/api.js';
import { useIsDesktop } from '../lib/useMedia.js';
import { getDiscover, DISCOVER_CATS, ageLabel } from '../lib/discover.js';
import { addItem, sendReport, sendCrowdReport, recentCrowd, saveKey, useToast } from '../lib/store.js';

const TABS = [
  ['overview', 'Overview'], ['itinerary', 'Itinerary'], ['food', 'Food'], ['cafe', 'Cafes'], ['couple', 'Couple spots'],
  ['family', 'Family dining'], ['sight', 'Popular'], ['busy', 'Crowded'], ['quiet', 'Skip the crowds'], ['stay', 'Stays'], ['scams', 'Scams']
];

export default function Place() {
  const [params, setParams] = useSearchParams();
  const name = params.get('name') || 'This place';
  const region = params.get('region') || '';
  const lat = +params.get('lat');
  const lon = +params.get('lon');
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });

  const { weather, clock, timeOfDay } = useLiveConditions(lat, lon);
  const [guide, setGuide] = useState(undefined); // undefined = loading, null = none
  const [nearby, setNearby] = useState(undefined);
  const [nearbyErr, setNearbyErr] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const desktop = useIsDesktop();

  useEffect(() => {
    let alive = true;
    setGuide(undefined); setNearby(undefined); setNearbyErr('');
    getGuide(name).then((g) => alive && setGuide(g)).catch(() => alive && setGuide(null));
    getNearby(lat, lon).then((n) => alive && setNearby(n)).catch((e) => { if (alive) { setNearby(null); setNearbyErr(e.message); } });
    return () => { alive = false; };
  }, [name, lat, lon]);

  const kind = detectSceneKind({ name, summary: guide?.summary, elevation: weather?.elevation });
  const itinerary = useMemo(() => (guide !== undefined && nearby !== undefined ? buildItinerary(guide, nearby) : null), [guide, nearby]);
  const crowdOf = (cat) => estimateCrowd(cat, clock.hour, clock.weekday);
  const place = { type: 'wishlist', name, lat, lon, city: name, note: region };

  const pinned = useMemo(() => {
    const out = [];
    const sights = nearby?.sight?.filter((s) => s.important) || [];
    if (guide?.see?.[0]) out.push({ ...guide.see[0], cat: 'sight', badge: { text: crowdOf('sight') === 'Busy' ? 'Busy now' : 'Must see', dark: crowdOf('sight') === 'Busy' } });
    else if (sights[0]) out.push({ ...sights[0], badge: { text: 'Must see' } });
    if (nearby?.couple?.[0]) out.push({ ...nearby.couple[0], badge: { text: 'Couple spot' } });
    if (guide?.dishes?.[0]) out.push({ name: guide.dishes[0], cat: 'dish', type: 'dish', badge: { text: 'Must eat' } });
    else if (nearby?.food?.[0]) out.push({ ...nearby.food[0], badge: { text: 'Must eat' } });
    if (nearby?.cafe?.[0]) out.push({ ...nearby.cafe[0], badge: { text: 'Cafe' } });
    if (guide?.see?.[1]) out.push({ ...guide.see[1], cat: 'sight', badge: { text: 'Popular' } });
    if (nearby?.family?.[0]) out.push({ ...nearby.family[0], badge: { text: 'Family' } });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, nearby, clock.hour]);

  const saveTrip = async () => {
    if (!itinerary?.length) return;
    const id = await addItem('trips', { title: `${name} trip`, destination: name, lat, lon, source: 'generated', days: itinerary });
    toast('Itinerary saved to Trips');
    nav(`/trips/${id}`);
  };

  return (
    <div className="page">
      <TopBar right={
        <button className="icon-btn" aria-label="Share this place" onClick={() => {
          const url = window.location.href;
          if (navigator.share) navigator.share({ title: `${name} on Wanderpin`, url }).catch(() => {});
          else { navigator.clipboard?.writeText(url); toast('Link copied'); }
        }}><Icon name="share" size={20} /></button>
      } />

      <div style={{ position: 'relative', borderRadius: 28, overflow: 'hidden' }}>
        <Scene timeOfDay={timeOfDay} weather={weather?.kind} kind={kind} height={desktop ? 420 : 300} />
        <div className="row wrap" style={{ position: 'absolute', left: 14, top: 14, right: 70 }}>
          <span className="row" style={{ background: 'var(--paper)', borderRadius: 20, padding: '8px 12px', fontSize: 13, fontWeight: 500, gap: 6 }}>
            <Icon name={weather?.kind === 'rain' ? 'rain' : weather?.kind === 'cloudy' ? 'cloud' : timeOfDay === 'night' ? 'moon' : 'sun'} size={16} />
            {weather ? `${weather.temp}° ${weather.label}` : '—'}
          </span>
          <span style={{ background: 'var(--paper)', borderRadius: 20, padding: '8px 12px', fontSize: 13, fontWeight: 500 }}>{clock.time} local</span>
        </div>
        <div style={{ position: 'absolute', right: 14, top: 10 }}><SaveButton item={place} label="Add to wishlist" /></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ fontSize: desktop ? 64 : 44, lineHeight: 1 }}>{name}</h1>
        {region && <div className="sub">{region}</div>}
        {guide?.summary && <p style={{ margin: '6px 0 0', fontSize: desktop ? 17 : 15, lineHeight: 1.55, color: 'var(--muted)', maxWidth: 820 }}>{guide.summary}</p>}
      </div>

      <div className="chips" role="tablist" aria-label="Sections">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <Link to="/import" className="card row" style={{ textDecoration: 'none', gap: 14, padding: 16, border: '1px dashed var(--accent)' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="reel" /></span>
            <span className="grow"><b style={{ fontSize: 15 }}>Saw a {name} reel you loved?</b><br /><span className="sub" style={{ fontSize: 13 }}>Share or paste it to turn it into a plan</span></span>
            <Icon name="chevron" size={20} />
          </Link>

          <section className="section">
            <div className="section-head"><h2>Pinned for you</h2><button className="chip" style={{ height: 34 }} onClick={() => setTab('sight')}>See all</button></div>
            {pinned.length ? (
              <div className="masonry">
                <div>{pinned.filter((_, i) => i % 2 === 0).map((p, i) => <PinTile key={p.name} item={{ ...p, city: name }} height={i % 2 ? 150 : 210} badge={p.badge} />)}</div>
                <div>{pinned.filter((_, i) => i % 2 === 1).map((p, i) => <PinTile key={p.name} item={{ ...p, city: name }} height={i % 2 ? 200 : 160} badge={p.badge} />)}</div>
              </div>
            ) : nearby === undefined || guide === undefined ? <Skeleton h={160} n={2} /> : <div className="sub">No pins yet for this place.</div>}
          </section>

          <ScamBlock guide={guide} compact onMore={() => setTab('scams')} />

          {weather?.daily?.length > 0 && (
            <section className="section">
              <h2>Next few days</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {weather.daily.map((d) => (
                  <div key={d.date} className="card" style={{ textAlign: 'center' }}>
                    <div className="sub" style={{ fontSize: 13 }}>{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{d.max}°</div>
                    <div className="sub" style={{ fontSize: 13 }}>low {d.min}°</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'itinerary' && (
        <section className="section">
          <div className="section-head"><h2>Suggested plan</h2>{itinerary?.length > 0 && <button className="btn accent" style={{ height: 40 }} onClick={saveTrip}><Icon name="bookmark" size={18} />Save & edit</button>}</div>
          {!itinerary ? <Skeleton h={90} /> : itinerary.length === 0 ? <div className="sub">Not enough info to build a plan for this place yet. Try a nearby city, or build your own trip.</div> : <div className="list wide3">{itinerary.map((day) => (
            <div key={day.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 20 }}>{day.title}</h3>
              {day.stops.map((s, i) => (
                <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, marginTop: 5, background: ['var(--accent)', '#E8A3A0', '#E9C46A', '#7FA6A3'][i % 4], flexShrink: 0 }} />
                  <div className="grow">
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{s.time}</div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    {s.note && <div className="sub" style={{ fontSize: 13, lineHeight: 1.4 }}>{s.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          ))}</div>}
        </section>
      )}

      {DISCOVER_CATS[tab] && <AIPicks cat={tab} lat={lat} lon={lon} name={name} />}

      {tab === 'food' && (
        <section className="section">
          {guide?.dishes?.length > 0 && (
            <>
              <h2>Famous food to try</h2>
              <div className="row wrap">
                {guide.dishes.map((d) => <DishChip key={d} dish={d} city={name} />)}
              </div>
            </>
          )}
          {guide?.eat?.length > 0 && <><h2>Recommended places to eat</h2><div className="list">{guide.eat.slice(0, 12).map((e) => <PlaceRow key={e.name} item={{ ...e, cat: 'food' }} city={name} />)}</div></>}
          <h2>Street food and snacks nearby</h2>
          <CatList items={nearby?.food} loading={nearby === undefined} err={nearbyErr} cat="food" city={name} crowd={crowdOf('food')} />
        </section>
      )}

      {['cafe', 'couple', 'family', 'sight', 'stay'].includes(tab) && (
        <section className="section">
          <div className="section-head"><h2>{CATEGORIES[tab].label}</h2><span className="sub">{tab === 'stay' ? '' : 'Crowd is an estimate'}</span></div>
          {tab === 'sight' && guide?.see?.length > 0 && <div className="list">{guide.see.slice(0, 10).map((s) => <PlaceRow key={s.name} item={{ ...s, cat: 'sight' }} city={name} crowd={crowdOf('sight')} />)}</div>}
          {tab === 'stay' && guide?.sleep?.length > 0 && <div className="list">{guide.sleep.slice(0, 8).map((s) => <PlaceRow key={s.name} item={{ ...s, cat: 'stay' }} city={name} />)}</div>}
          <CatList items={nearby?.[tab]} loading={nearby === undefined} err={nearbyErr} cat={tab} city={name} crowd={tab === 'stay' ? null : crowdOf(tab)} />
        </section>
      )}

      {tab === 'busy' && (
        <section className="section">
          <div><h2>Crowded right now</h2><div className="sub">Estimated from the time ({clock.time}, {clock.weekday}) and the type of place, plus live check-ins from travellers.</div></div>
          <CrowdList items={nearby?.busy} loading={nearby === undefined} err={nearbyErr} city={name} clock={clock} filter={(l) => l === 'Busy' || l === 'Moderate'} empty="Nothing looks packed right now." />
        </section>
      )}

      {tab === 'quiet' && (
        <section className="section">
          <div><h2>Calm right now</h2><div className="sub">Places that are usually quiet at this hour.</div></div>
          <CrowdList items={[...(nearby?.couple || []), ...(nearby?.sight || []), ...(nearby?.cafe || [])]} loading={nearby === undefined} err={nearbyErr} city={name} clock={clock} filter={(l) => l === 'Quiet' || l === 'Calm'} empty="Everything is busy at this hour. Try early morning." />
        </section>
      )}

      {tab === 'scams' && <ScamBlock guide={guide} />}

      <button className="btn ghost" onClick={() => setReportOpen(true)} style={{ alignSelf: 'center' }}><Icon name="flag" size={18} />Something missing or wrong? Report</button>
      {guide?.url && <div className="sub" style={{ fontSize: 12, textAlign: 'center' }}>Guide info from <a href={guide.url} target="_blank" rel="noreferrer">Wikivoyage</a> (CC BY-SA). Places from OpenStreetMap. Weather by Open-Meteo.</div>}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={{ type: 'place', destination: name, url: window.location.href }} />
    </div>
  );
}

function AIPicks({ cat, lat, lon, name }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let alive = true;
    setD(null);
    getDiscover(cat, lat, lon, { place: name }).then((r) => alive && setD(r)).catch(() => alive && setD({ status: 'error' }));
    return () => { alive = false; };
  }, [cat, lat, lon, name]);
  const url = `/discover?cat=${cat}&name=${encodeURIComponent(name)}&lat=${lat}&lon=${lon}`;
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: 'var(--ink)', color: 'var(--paper)', border: 'none' }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="row" style={{ gap: 8 }}><span className="tag" style={{ background: 'var(--accent)', color: 'var(--paper)' }}>AI picks</span><b style={{ fontSize: 18 }}>Best {DISCOVER_CATS[cat].label.toLowerCase()}</b></div>
          {d?.status === 'ok' && <div style={{ fontSize: 12, opacity: .7, marginTop: 4 }}>Shared by Wanderpin travellers · {ageLabel(d.updatedAt)}</div>}
        </div>
        <Link to={url} className="btn accent" style={{ height: 38, textDecoration: 'none' }}><Icon name="map" size={16} />Open map</Link>
      </div>
      {!d && <div style={{ fontSize: 14, opacity: .8 }}>Finding the best spots… the first search for an area takes a few seconds.</div>}
      {d?.status === 'ok' && (
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {d.items.slice(0, 5).map((it) => (
            <li key={it.id} style={{ fontSize: 14, lineHeight: 1.45 }}><b>{it.name}</b>{it.why ? <span style={{ opacity: .75 }}> · {it.why}</span> : null}</li>
          ))}
        </ol>
      )}
      {d && d.status !== 'ok' && <div style={{ fontSize: 14, opacity: .8 }}>AI picks aren't available here right now. The full list below still works.</div>}
    </section>
  );
}

function DishChip({ dish, city }) {
  const item = { type: 'dish', name: dish, city };
  return (
    <span className="row" style={{ gap: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 22, padding: '2px 2px 2px 14px' }}>
      <span style={{ fontWeight: 500, fontSize: 14 }}>{dish}</span>
      <SaveButton item={item} size={36} />
    </span>
  );
}

function CatList({ items, loading, err, cat, city, crowd }) {
  if (loading) return <Skeleton />;
  if (err) return <div className="alert">{err}</div>;
  if (!items?.length) return <div className="sub">Nothing found within 4 km. Try a bigger city nearby.</div>;
  return <div className="list">{items.slice(0, 25).map((p) => <PlaceRow key={p.id} item={p} city={city} crowd={crowd} />)}</div>;
}

function CrowdList({ items, loading, err, city, clock, filter, empty }) {
  const [live, setLive] = useState({});
  const [checkIn, setCheckIn] = useState(null);
  const toast = useToast();
  const list = (items || []).map((p) => ({ ...p, crowd: live[p.id]?.level || estimateCrowd(p.cat, clock.hour, clock.weekday) })).filter((p) => filter(p.crowd)).slice(0, 20);
  useEffect(() => {
    list.slice(0, 10).forEach((p) => {
      if (live[p.id] !== undefined) return;
      recentCrowd(saveKey(p)).then((r) => setLive((m) => ({ ...m, [p.id]: r })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  if (loading) return <Skeleton />;
  if (err) return <div className="alert">{err}</div>;
  if (!list.length) return <div className="sub">{empty}</div>;
  return (
    <div className="list">
      {list.map((p) => (
        <PlaceRow key={p.id} item={p} city={city} crowd={p.crowd} extra={
          <button onClick={() => setCheckIn(p)} style={{ border: 'none', background: 'none', padding: '6px 0 0', color: 'var(--accent-ink)', fontWeight: 700, fontSize: 13 }}>
            {live[p.id] ? `${live[p.id].count} live check-in${live[p.id].count > 1 ? 's' : ''} · ` : ''}I'm here, report crowd
          </button>
        } />
      ))}
      <Sheet open={!!checkIn} onClose={() => setCheckIn(null)} title="How busy is it?">
        <div className="sub">{checkIn?.name}. Your check-in helps other travellers for the next 3 hours.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {['Quiet', 'Calm', 'Moderate', 'Busy'].map((l, i) => (
            <button key={l} className="btn ghost" onClick={async () => {
              await sendCrowdReport(saveKey(checkIn), i);
              setLive((m) => ({ ...m, [checkIn.id]: { level: l, count: (m[checkIn.id]?.count || 0) + 1 } }));
              setCheckIn(null); toast('Thanks! Crowd updated');
            }}>{l}</button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function ScamBlock({ guide, compact, onMore }) {
  if (guide === undefined) return <Skeleton h={90} n={1} />;
  const scams = guide?.scams || [];
  const tips = guide?.safetyTips || [];
  const general = [
    'Unofficial "guides" or drivers who insist a place is closed and take you elsewhere for commission.',
    'Taxis or autos without a meter. Fix the fare before the ride.',
    'Gem, carpet or souvenir "resale profit" deals. Nobody sells you profit.',
    'Crowded spots: keep phones and wallets in front pockets.'
  ];
  const list = scams.length ? scams : tips.length ? tips : general;
  const shown = compact ? list.slice(0, 2) : list;
  return (
    <section className="alert" style={{ flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ gap: 10 }}><Icon name="warn" /><b style={{ fontSize: 16 }}>{scams.length ? 'Scams reported here' : 'Watch out for'}</b></div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.45 }}>
        {shown.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
      {!scams.length && <div style={{ fontSize: 12, opacity: .85 }}>No place-specific reports yet, so these are common tricks for travellers anywhere.</div>}
      {compact && list.length > 2 && <button onClick={onMore} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontWeight: 700, color: 'var(--danger)', textDecoration: 'underline' }}>See all {list.length}</button>}
    </section>
  );
}

export function ReportSheet({ open, onClose, context }) {
  const [reason, setReason] = useState('Wrong info');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const reasons = context?.type === 'reel'
    ? ['Couldn\'t read the reel', 'Wrong places found', 'Missing places', 'Other']
    : ['Wrong info', 'Missing places', 'Scam to add', 'Other'];
  useEffect(() => { if (open) { setSent(false); setMessage(''); setReason(reasons[0]); } }, [open]); // eslint-disable-line
  return (
    <Sheet open={open} onClose={onClose} title={sent ? 'Thanks for reporting' : 'Report a problem'}>
      {sent ? (
        <>
          <div className="sub">We read every report and use it to make Wanderpin better.</div>
          <button className="btn" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <div className="row wrap">{reasons.map((r) => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
          <label className="sub" htmlFor="report-msg">Tell us more (optional)</label>
          <textarea id="report-msg" className="field" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1900))} placeholder="What should be here?" />
          <button className="btn accent" onClick={async () => {
            await sendReport({ ...context, reason, message });
            setSent(true);
          }}>Send report</button>
        </>
      )}
    </Sheet>
  );
}
