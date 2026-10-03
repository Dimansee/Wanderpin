import { useEffect, useId, useRef, useState } from 'react';

// Colour sets per time of day (from the approved design)
export const PALETTES = {
  morning:   { s1: '#CFE3F7', s2: '#F6D9D2', s3: '#FFE7B8', far: '#B9C7E3', mid: '#9DBB9A', near: '#7FA37E', build: '#9C7FB8', win: '#FFF1C9', w1: '#A9CBEA', w2: '#86AEDB', sand: '#F1D9A7', sunY: 0.40, sun: 1, moon: 0, stars: 0, cloud: .9, ink: '#2B2420' },
  afternoon: { s1: '#B9D4F2', s2: '#DCE8F5', s3: '#FBE9C6', far: '#A9BFDF', mid: '#8FB38C', near: '#6E9A6E', build: '#8E74AE', win: '#FFF1C9', w1: '#8FB7E8', w2: '#6E8FD6', sand: '#F3DDB0', sunY: 0.22, sun: 1, moon: 0, stars: 0, cloud: .9, ink: '#2B2420' },
  evening:   { s1: '#B9A7F0', s2: '#F8B9C6', s3: '#FFD9A8', far: '#C79BD6', mid: '#A47FC9', near: '#7C5BA8', build: '#6E4FA8', win: '#FFD9A8', w1: '#8FB7E8', w2: '#6E8FD6', sand: '#E9B98F', sunY: 0.46, sun: 1, moon: 0, stars: .3, cloud: .75, ink: '#2A2350' },
  night:     { s1: '#0F1530', s2: '#262B52', s3: '#4A3F6B', far: '#2C2F52', mid: '#232744', near: '#1A1D34', build: '#2A2D4A', win: '#F2B544', w1: '#1E2342', w2: '#121530', sand: '#3A3556', sunY: 0.22, sun: 0, moon: 1, stars: 1, cloud: .15, ink: '#FFFDF9' }
};

export function timeOfDayFromHour(h) {
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'afternoon';
  if (h >= 16 && h < 19) return 'evening';
  return 'night';
}

/* Smooth rolling ridge across the full width (base at fraction fy of height). */
function hills(W, H, fy, amp, waves, phase = 0, bottom = H) {
  const pts = [];
  const step = Math.max(6, W / 120);
  for (let x = 0; x <= W + step; x += step) {
    const t = (x / W) * Math.PI * 2 * waves + phase;
    const y = H * fy - amp * (0.6 * Math.sin(t) + 0.4 * Math.sin(t * 2.3 + 1.1));
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M0 ${bottom} L${pts.join(' L')} L${W} ${bottom} Z`;
}

/* Jagged mountain ridge; returns path + the peak points (for snow caps). */
function peaks(W, H, fy, height, count, seed) {
  const pts = [[0, H * fy]];
  const tops = [];
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count) * W + Math.sin(seed + i * 7.1) * (W / count) * 0.18;
    const h = height * (0.65 + 0.35 * Math.abs(Math.sin(seed * 3 + i * 2.7)));
    tops.push([x, H * fy - h]);
    pts.push([x, H * fy - h], [((i + 1) / count) * W, H * fy - height * 0.15]);
  }
  return { d: `M0 ${H} L${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} L${W} ${H} Z`, tops };
}

const rnd = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;

function Palace({ cx, base, fill, win, scale = 1 }) {
  return (
    <g transform={`translate(${cx} ${base}) scale(${scale})`}>
      <g fill={fill}>
        <rect x="-95" y="-62" width="190" height="62" rx="5" />
        <rect x="-75" y="-92" width="28" height="32" /><circle cx="-61" cy="-92" r="15" />
        <rect x="-17" y="-110" width="34" height="50" /><circle cx="0" cy="-110" r="18" />
        <rect x="47" y="-88" width="26" height="28" /><circle cx="60" cy="-88" r="13" />
      </g>
      <g className="a-glow" fill={win}>
        {[-75, -51, -27, -3, 21, 45, 69].map((x) => <rect key={x} x={x} y="-44" width="9" height="15" rx="4.5" />)}
      </g>
    </g>
  );
}

function Balloon({ x, y, accent, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="a-balloon">
        <path d="M0 70 c-22 0 -34 -18 -34 -36 a34 34 0 0 1 68 0 c0 18 -12 36 -34 36z" fill={accent} />
        <path d="M0 70 c-8 0 -12 -18 -12 -36 c0 -20 6 -34 12 -34 c6 0 12 14 12 34 c0 18 -4 36 -12 36z" fill="#F5EFE6" opacity=".55" />
        <path d="M-8 72 l3 12 M8 72 l-3 12" stroke="#2B2420" strokeWidth="1.2" />
        <rect x="-6" y="84" width="12" height="9" rx="2" fill="#2B2420" />
      </g>
    </g>
  );
}

function Boat({ x, y }) {
  return <g className="a-bob"><path d={`M${x} ${y} h44 l-8 10 h-28z`} fill="#2B2420" /><path d={`M${x + 21} ${y} v-18 l12 18z`} fill="#FFFDF9" /></g>;
}

function Ripples({ W, y0, H }) {
  const n = Math.max(3, Math.round(W / 130));
  return Array.from({ length: n }).map((_, i) => (
    <rect key={i} className={i % 2 ? 'a-rip2' : 'a-rip'} x={(i / n) * W + rnd(i) * 60} y={y0 + rnd(i + 9) * (H - y0 - 10)} width={50 + rnd(i + 3) * 60} height="3" rx="1.5" fill="#fff" />
  ));
}

function Foreground({ kind, p, W, H, accent, wid }) {
  const wide = W > 700;
  const s = wide ? 1.25 : 1;
  switch (kind) {
    case 'beach': {
      const base = H * 0.64;
      return (
        <>
          <rect x="0" y={base} width={W} height={H - base} fill={`url(#${wid})`} />
          <Ripples W={W} y0={base + 10} H={H * 0.82} />
          <path d={hills(W, H, 0.88, 8, 2, 1)} fill={p.sand} />
          <Boat x={W * 0.3} y={base + 22} />
          <g fill={p.near} transform={`translate(${W * 0.8} 0)`}>
            <path d={`M0 ${H} q4 -60 -6 -110`} stroke={p.near} strokeWidth="7" fill="none" />
            <path d={`M-6 ${H - 110} q-30 -12 -50 8 q24 -4 50 -8z M-6 ${H - 110} q30 -14 52 4 q-26 -2 -52 -4z M-6 ${H - 110} q-10 -26 -34 -30 q18 14 34 30z M-6 ${H - 110} q14 -26 38 -26 q-22 10 -38 26z`} />
          </g>
        </>
      );
    }
    case 'mountain': {
      const back = peaks(W, H, 0.62, H * 0.36, Math.max(3, Math.round(W / 160)), 2);
      return (
        <>
          <path d={back.d} fill={p.far} />
          <g fill="#FFFDF9" opacity=".9">
            {back.tops.map(([x, y], i) => <path key={i} d={`M${x} ${y} l-18 ${H * 0.07} l12 -4 l6 6 l8 -8 l10 6z`} />)}
          </g>
          <path d={hills(W, H, 0.78, 14, 2.2, .5)} fill={p.mid} />
          <g fill={p.near}>
            {Array.from({ length: Math.max(4, Math.round(W / 70)) }).filter((_, i) => rnd(i) > 0.35).map((_, i) => {
              const x = rnd(i + 20) * W;
              return <path key={i} d={`M${x} ${H * 0.93} l14 -46 l14 46z`} />;
            })}
          </g>
          <path d={hills(W, H, 0.92, 6, 1.5, 2)} fill={p.near} />
        </>
      );
    }
    case 'desert':
      return (
        <>
          <path d={hills(W, H, 0.68, 18, 1.6, .3)} fill={p.sand} opacity=".85" />
          <path d={hills(W, H, 0.8, 16, 1.2, 2.2)} fill={p.sand} />
          <g fill="#2B2420" opacity={p.ink === '#FFFDF9' ? .7 : .85} transform={`translate(${W * 0.6} ${H * 0.7}) scale(${s})`}>
            <path d="M0 0 q6 -14 16 -10 q8 -10 18 -2 q6 -6 12 0 l4 -8 l4 2 l-4 12 l0 18 h-3 v-12 h-24 v12 h-3 v-12 q-6 0 -6 -6 l0 18 h-3z" />
          </g>
        </>
      );
    case 'city': {
      const n = Math.ceil(W / 46);
      return (
        <>
          <path d={hills(W, H, 0.6, 12, 1.4, 1)} fill={p.far} />
          <g fill={p.build}>
            {Array.from({ length: n }).map((_, i) => (
              <rect key={i} x={i * 46 + rnd(i) * 6} y={H * (0.3 + rnd(i + 5) * 0.22)} width={36 + rnd(i + 2) * 16} height={H} rx="3" />
            ))}
          </g>
          <g className="a-glow" fill={p.win}>
            {Array.from({ length: n * 2 }).map((_, i) => (
              <rect key={i} x={Math.floor(i / 2) * 46 + 10 + (i % 2) * 14} y={H * (0.56 + rnd(i + 40) * 0.2)} width="8" height="10" rx="2" />
            ))}
          </g>
          <path d={hills(W, H, 0.87, 5, 1, 2)} fill={p.near} />
        </>
      );
    }
    case 'lake':
      return (
        <>
          <path d={hills(W, H, 0.54, 16, 1.8, .8, H * 0.7)} fill={p.far} />
          <Palace cx={W * 0.45} base={H * 0.68} fill={p.build} win={p.win} scale={s} />
          <rect x="0" y={H * 0.68} width={W} height={H * 0.32} fill={`url(#${wid})`} />
          <Ripples W={W} y0={H * 0.72} H={H * 0.95} />
          <Boat x={W * 0.62} y={H * 0.77} />
        </>
      );
    default: // home: hills, road and balloon
      return (
        <>
          <path d={hills(W, H, 0.6, 26, 2.4, .2)} fill={p.far} />
          <path d={hills(W, H, 0.7, 18, 1.6, 1.7)} fill={p.mid} />
          <path d={hills(W, H, 0.82, 14, 1.2, 3.1)} fill={p.near} />
          <path d={`M${W * 0.54} ${H} C${W * 0.54} ${H * 0.91} ${W * 0.38} ${H * 0.89} ${W * 0.49} ${H * 0.84} C${W * 0.56} ${H * 0.8} ${W * 0.67} ${H * 0.81} ${W * 0.64} ${H * 0.77}`} fill="none" stroke={p.sand} strokeWidth="14" strokeLinecap="round" />
          <Balloon x={wide ? W * 0.62 : W * 0.66} y={wide ? H * 0.26 : H * 0.5} accent={accent} s={s} />
          {wide && <Balloon x={W * 0.86} y={H * 0.42} accent="#E9C46A" s={0.7} />}
        </>
      );
  }
}

/** Live animated scene that fills its container's width. Changes with time of day, weather and place type. */
export default function Scene({ timeOfDay = 'afternoon', kind = 'home', weather = 'clear', height = 470, accent = '#B5694A', rounded = 0 }) {
  const id = useId().replace(/:/g, '');
  const ref = useRef(null);
  const [W, setW] = useState(390);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(320, Math.round(el.clientWidth || 390)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const p = PALETTES[timeOfDay] || PALETTES.afternoon;
  const H = height;
  const cloudy = weather === 'cloudy' || weather === 'rain' || weather === 'snow';
  const sunOp = cloudy ? p.sun * 0.45 : p.sun;
  const sunX = W > 700 ? W * 0.8 : W * 0.77;
  const clouds = Math.max(2, Math.round(W / 300));

  return (
    <div ref={ref} style={{ width: '100%', lineHeight: 0 }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block', borderRadius: rounded, '--w': `${W + 200}px` }} role="img" aria-label={`${timeOfDay} scene`}>
        <defs>
          <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.s1} /><stop offset=".55" stopColor={cloudy ? p.s1 : p.s2} /><stop offset="1" stopColor={p.s3} />
          </linearGradient>
          <linearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.w1} /><stop offset="1" stopColor={p.w2} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#sky${id})`} />
        <g fill="#fff" opacity={p.stars}>
          {Array.from({ length: Math.round(W / 40) }).map((_, i) => (
            <circle key={i} className={i % 2 ? 'a-tw2' : 'a-tw1'} cx={rnd(i) * W} cy={H * (0.05 + rnd(i + 50) * 0.35)} r={1 + rnd(i + 7) * 0.8} />
          ))}
        </g>
        <g className="a-sun" opacity={sunOp}>
          <circle cx={sunX} cy={H * p.sunY} r="62" fill="#FFF1C9" opacity=".35" />
          <circle cx={sunX} cy={H * p.sunY} r="42" fill="#FFF1C9" />
        </g>
        <g opacity={p.moon}>
          <circle cx={sunX} cy={H * 0.26} r="28" fill="#F4E6C3" />
          <circle cx={sunX + 13} cy={H * 0.24} r="25" fill={p.s1} />
        </g>
        {Array.from({ length: clouds }).map((_, i) => (
          <g key={i} className={i % 2 ? 'a-cloud2' : 'a-cloud1'} style={{ animationDelay: `${-i * 9}s`, animationDuration: `${(W + 200) / 18 + i * 6}s` }}
            fill="#fff" opacity={cloudy ? Math.max(p.cloud, .6) : p.cloud * (i % 2 ? .8 : 1)}>
            <ellipse cx="60" cy={H * (0.12 + rnd(i + 30) * 0.16)} rx="44" ry="14" />
            <ellipse cx="82" cy={H * (0.12 + rnd(i + 30) * 0.16) - 8} rx="24" ry="16" />
          </g>
        ))}
        <Foreground kind={kind} p={p} W={W} H={H} accent={accent} wid={`w${id}`} />
        <g className="a-birds" style={{ animationDuration: `${(W + 200) / 30}s` }} fill="none" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" opacity={timeOfDay === 'night' ? 0 : 1}>
          <path d={`M0 ${H * 0.3} q6 -6 12 0 q6 -6 12 0`} /><path d={`M30 ${H * 0.27} q5 -5 10 0 q5 -5 10 0`} />
        </g>
        {weather === 'rain' && (
          <g className="a-rain" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity=".55">
            {Array.from({ length: Math.round(W / 14) }).map((_, i) => {
              const x = rnd(i) * W, y = rnd(i + 99) * H;
              return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 12} />;
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
