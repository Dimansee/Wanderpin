import { useEffect, useState } from 'react';
import Globe from './Globe.jsx';

/**
 * First-load splash: big spinning globe in the centre, then it shrinks and
 * glides into the header slot marked with data-globe-slot, still spinning.
 */
export default function Loader({ ready, onDone }) {
  const [phase, setPhase] = useState('loading'); // loading -> moving -> gone
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!ready || phase !== 'loading') return;
    const t = setTimeout(() => {
      const slot = document.querySelector('[data-globe-slot]');
      if (slot) {
        const r = slot.getBoundingClientRect();
        setTarget({ left: r.left + r.width / 2 - 20, top: r.top + r.height / 2 - 20 });
      }
      setPhase('moving');
    }, 900);
    return () => clearTimeout(t);
  }, [ready, phase]);

  useEffect(() => {
    if (phase !== 'moving') return;
    const t = setTimeout(() => { setPhase('gone'); onDone?.(); }, 1100);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase === 'gone') return null;

  const big = { left: 'calc(50% - 70px)', top: 'calc(50% - 90px)', width: 140, height: 140 };
  const small = target
    ? { left: target.left, top: target.top, width: 40, height: 40 }
    : { left: 'calc(100% - 64px)', top: 22, width: 40, height: 40, opacity: 0 };

  return (
    <div className={`loader ${phase === 'moving' ? 'done' : ''}`} role="status" aria-label="Loading Wanderpin">
      <div className="loader-bg" />
      <div className="loader-globe" style={phase === 'moving' ? small : big}>
        <Globe size="100%" stroke={2.6} />
      </div>
      <div className="loader-text">
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700 }}>Wanderpin</div>
        <div className="row" style={{ fontSize: 15, color: 'var(--muted)', gap: 6 }}>
          Packing your next trip
          <span className="dot" /><span className="dot" style={{ animationDelay: '.2s' }} /><span className="dot" style={{ animationDelay: '.4s' }} />
        </div>
      </div>
    </div>
  );
}
