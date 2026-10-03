import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TopBar, SaveButton } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import Globe from '../components/Globe.jsx';
import { ReportSheet } from './Place.jsx';
import { addItem, useToast } from '../lib/store.js';
import { searchPlaces } from '../lib/api.js';
import { placeUrl } from '../components/SearchBox.jsx';

const findUrl = (s) => ((s || '').match(/https?:\/\/\S+/) || [])[0] || '';
const STEPS = ['Opening the reel', 'Reading the caption', 'Spotting places and food', 'Building your itinerary'];

export default function Import() {
  const [params] = useSearchParams();
  const shared = params.get('url') || findUrl(params.get('text')) || findUrl(params.get('title'));
  const [link, setLink] = useState(shared || '');
  const [caption, setCaption] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const [step, setStep] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const toast = useToast();
  const nav = useNavigate();
  const started = useRef(false);

  const run = async ({ url = link, cap = caption } = {}) => {
    if (!url.trim() && !cap.trim()) return;
    setState({ status: 'loading' }); setStep(0);
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    try {
      const r = await fetch('/api/reel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim(), caption: cap.trim() }) });
      const data = await r.json();
      setState(data);
    } catch {
      setState({ status: 'error', message: 'Could not reach Wanderpin. Check your connection and try again.' });
    } finally { clearInterval(ticker); }
  };

  // Auto-start when opened from Instagram's share sheet or a pasted link
  useEffect(() => {
    if (shared && !started.current) { started.current = true; run({ url: shared, cap: '' }); }
  }, [shared]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTrip = async () => {
    const t = state.trip;
    let geo = {};
    if (t.destination) { try { const r = await searchPlaces(t.destination); if (r[0]) geo = { lat: r[0].lat, lon: r[0].lon }; } catch { /* ignore */ } }
    const extraDay = [...(t.food || []).map((f) => ({ name: f, time: 'Food', note: 'Mentioned in the reel' })), ...(t.cafes || []).map((c) => ({ name: c, time: 'Cafe', note: 'Mentioned in the reel' }))];
    const days = [...(t.days || [])];
    if (extraDay.length) days.push({ title: 'Food and cafes from the reel', stops: extraDay });
    const id = await addItem('trips', {
      title: t.title || `${t.destination || 'Reel'} trip`, destination: t.destination || '', ...geo, days,
      notes: [...(t.tips || []).map((x) => `Tip: ${x}`), ...(t.scams || []).map((x) => `Watch out: ${x}`), ...(t.stays || []).map((x) => `Stay: ${x}`)].join('\n'),
      source: 'reel', reelUrl: link || null
    });
    toast('Trip saved. Edit anything you like');
    nav(`/trips/${id}`);
  };

  const openDestination = async () => {
    const r = await searchPlaces(state.trip.destination);
    if (r[0]) nav(placeUrl(r[0]));
  };

  const reportCtx = { type: 'reel', url: link || '', caption: (caption || state.text || '').slice(0, 4900) };

  return (
    <div className="page">
      <TopBar title="Plan from a reel" />

      {state.status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '40px 0' }}>
          <Globe size={120} />
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{STEPS[step]}…</div>
          <div className="list single" style={{ width: '100%', maxWidth: 300 }}>
            {STEPS.map((s, i) => (
              <div key={s} className="row" style={{ gap: 10, color: i <= step ? 'var(--ink)' : 'var(--muted)', opacity: i <= step ? 1 : .5 }}>
                <Icon name={i < step ? 'check' : 'clock'} size={18} />{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {(state.status === 'idle' || state.status === 'need_caption' || state.status === 'error' || state.status === 'nothing_found') && (
        <>
          {state.status === 'idle' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 18, background: 'var(--ink)', color: 'var(--paper)', border: 'none' }}>
              <h2 style={{ fontSize: 24 }}>Saw a trip reel you loved?</h2>
              <div style={{ fontSize: 14, opacity: .85, lineHeight: 1.5 }}>Paste the reel link and Wanderpin pulls out every place, cafe and dish mentioned, then builds a day-by-day plan you can edit.</div>
            </div>
          )}

          {state.status === 'need_caption' && (
            <div className="alert tip" style={{ flexDirection: 'column', gap: 6 }}>
              <b>We couldn't read this reel on our own</b>
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>Instagram sometimes hides captions. Open the reel, tap "more" on the caption, copy it and paste it below. We'll do the rest.</div>
            </div>
          )}
          {state.status === 'error' && <div className="alert">{state.message}</div>}
          {state.status === 'nothing_found' && (
            <div className="alert" style={{ flexDirection: 'column', gap: 10 }}>
              <b>No places found in this reel</b>
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>The caption didn't name any spots. If the places are only shown in the video, paste them below or report it so we can improve.</div>
              <button className="btn" style={{ alignSelf: 'flex-start', height: 40 }} onClick={() => setReportOpen(true)}><Icon name="flag" size={18} />Report this reel</button>
            </div>
          )}

          <label className="search" style={{ paddingRight: 8 }}>
            <Icon name="link" size={18} />
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste Instagram reel or any travel link" aria-label="Reel link" inputMode="url" />
            {navigator.clipboard?.readText && (
              <button className="chip" style={{ height: 40 }} onClick={async () => { try { const t = await navigator.clipboard.readText(); setLink(findUrl(t) || t); } catch { /* denied */ } }}>Paste</button>
            )}
          </label>

          <div className="sub" style={{ textAlign: 'center' }}>or</div>
          <textarea className="field" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste the reel caption (or any list of places)" aria-label="Caption" />

          <button className="btn accent" disabled={!link.trim() && !caption.trim()} onClick={() => run()}><Icon name="reel" size={18} />Build my itinerary</button>

          <div className="card sub" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <b style={{ color: 'var(--ink)' }}>Share straight from Instagram (Android):</b> install Wanderpin from your Profile tab, then on any reel tap Share → Wanderpin.
          </div>
        </>
      )}

      {state.status === 'ok' && state.trip && (
        <>
          <div>
            <div className="sub row" style={{ gap: 6 }}><Icon name="reel" size={16} />Built from the reel</div>
            <h1 style={{ fontSize: 32, marginTop: 6 }}>{state.trip.title || 'Your reel trip'}</h1>
            {state.trip.destination && <button className="chip row" style={{ marginTop: 10, gap: 6 }} onClick={openDestination}><Icon name="pin" size={16} />Explore {state.trip.destination}</button>}
          </div>

          <div className="row">
            <button className="btn accent grow" onClick={saveTrip}><Icon name="bookmark" size={18} />Save as my trip</button>
            <button className="btn ghost" onClick={() => setReportOpen(true)} aria-label="Report a problem"><Icon name="flag" size={18} /></button>
          </div>

          {(state.trip.days || []).map((d, di) => (
            <section key={di} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 20 }}>{d.title || `Day ${di + 1}`}</h3>
              {(d.stops || []).map((s, i) => (
                <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, marginTop: 5, background: ['var(--accent)', '#E8A3A0', '#E9C46A', '#7FA6A3'][i % 4], flexShrink: 0 }} />
                  <div className="grow">
                    {s.time && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.time}</div>}
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    {s.note && <div className="sub" style={{ fontSize: 13 }}>{s.note}</div>}
                  </div>
                  <SaveButton item={{ type: 'place', name: s.name, city: state.trip.destination }} size={36} />
                </div>
              ))}
            </section>
          ))}

          {[['Food mentioned', state.trip.food, 'dish'], ['Cafes mentioned', state.trip.cafes, 'cafe'], ['Stays mentioned', state.trip.stays, 'stay']].map(([title, items, type]) => items?.length > 0 && (
            <section key={title} className="section">
              <h2>{title}</h2>
              <div className="row wrap">
                {items.map((f) => (
                  <span key={f} className="row" style={{ gap: 4, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 22, padding: '2px 2px 2px 14px' }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{f}</span>
                    <SaveButton item={{ type, name: f, city: state.trip.destination }} size={36} />
                  </span>
                ))}
              </div>
            </section>
          ))}

          {(state.trip.tips?.length > 0 || state.trip.scams?.length > 0) && (
            <section className="alert tip" style={{ flexDirection: 'column', gap: 8 }}>
              <b>From the creator</b>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.45 }}>
                {state.trip.tips?.map((t, i) => <li key={`t${i}`}>{t}</li>)}
                {state.trip.scams?.map((t, i) => <li key={`s${i}`}><b>Watch out:</b> {t}</li>)}
              </ul>
            </section>
          )}

          <button className="btn ghost" onClick={() => setState({ status: 'idle' })}>Try another reel</button>
        </>
      )}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={reportCtx} />
    </div>
  );
}
