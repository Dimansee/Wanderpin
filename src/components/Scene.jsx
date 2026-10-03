import { useId } from 'react';

// Colour sets per time of day (from the approved design)
export const PALETTES = {
  morning:   { s1: '#CFE3F7', s2: '#F6D9D2', s3: '#FFE7B8', far: '#B9C7E3', mid: '#9DBB9A', near: '#7FA37E', build: '#9C7FB8', win: '#FFF1C9', w1: '#A9CBEA', w2: '#86AEDB', sand: '#F1D9A7', sunY: 0.47, sun: 1, moon: 0, stars: 0, cloud: .9, ink: '#2B2420' },
  afternoon: { s1: '#B9D4F2', s2: '#DCE8F5', s3: '#FBE9C6', far: '#A9BFDF', mid: '#8FB38C', near: '#6E9A6E', build: '#8E74AE', win: '#FFF1C9', w1: '#8FB7E8', w2: '#6E8FD6', sand: '#F3DDB0', sunY: 0.26, sun: 1, moon: 0, stars: 0, cloud: .9, ink: '#2B2420' },
  evening:   { s1: '#B9A7F0', s2: '#F8B9C6', s3: '#FFD9A8', far: '#C79BD6', mid: '#A47FC9', near: '#7C5BA8', build: '#6E4FA8', win: '#FFD9A8', w1: '#8FB7E8', w2: '#6E8FD6', sand: '#E9B98F', sunY: 0.52, sun: 1, moon: 0, stars: .3, cloud: .75, ink: '#2A2350' },
  night:     { s1: '#0F1530', s2: '#262B52', s3: '#4A3F6B', far: '#2C2F52', mid: '#232744', near: '#1A1D34', build: '#2A2D4A', win: '#F2B544', w1: '#1E2342', w2: '#121530', sand: '#3A3556', sunY: 0.26, sun: 0, moon: 1, stars: 1, cloud: .15, ink: '#FFFDF9' }
};

export function timeOfDayFromHour(h) {
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'afternoon';
  if (h >= 16 && h < 19) return 'evening';
  return 'night';
}

const W = 390;

function Foreground({ kind, p, H, accent, wid }) {
  const base = H * 0.64;
  switch (kind) {
    case 'beach':
      return (
        <>
          <rect x="0" y={base} width={W} height={H - base} fill={`url(#${wid})`} />
          <path d={`M0 ${H * 0.86} Q120 ${H * 0.8} 240 ${H * 0.85} T${W} ${H * 0.83} V${H} H0Z`} fill={p.sand} />
          <rect className="a-rip" x="40" y={base + 18} width="80" height="3" rx="1.5" fill="#fff" />
          <rect className="a-rip2" x="220" y={base + 34} width="100" height="3" rx="1.5" fill="#fff" />
          <g fill={p.near}>
            <path d={`M300 ${H} q4 -60 -6 -110`} stroke={p.near} strokeWidth="7" fill="none" />
            <path d={`M294 ${H - 110} q-30 -12 -50 8 q24 -4 50 -8z M294 ${H - 110} q30 -14 52 4 q-26 -2 -52 -4z M294 ${H - 110} q-10 -26 -34 -30 q18 14 34 30z M294 ${H - 110} q14 -26 38 -26 q-22 10 -38 26z`} />
          </g>
          <g className="a-bob"><path d={`M120 ${base + 20} h40 l-7 9 h-26z`} fill="#2B2420" /><path d={`M140 ${base + 20} v-18 l12 18z`} fill="#FFFDF9" /></g>
        </>
      );
    case 'mountain':
      return (
        <>
          <path d={`M0 ${H * 0.62} L80 ${H * 0.3} L150 ${H * 0.55} L230 ${H * 0.22} L320 ${H * 0.5} L${W} ${H * 0.38} V${H} H0Z`} fill={p.far} />
          <path d={`M80 ${H * 0.3} l-18 ${H * 0.08} l12 -4 l6 6 l8 -8 l10 6z M230 ${H * 0.22} l-22 ${H * 0.1} l14 -5 l8 6 l10 -9 l12 8z`} fill="#FFFDF9" opacity=".9" />
          <path d={`M0 ${H * 0.8} Q100 ${H * 0.66} 200 ${H * 0.76} T${W} ${H * 0.72} V${H} H0Z`} fill={p.mid} />
          <g fill={p.near}>
            {[30, 60, 330, 360].map((x, i) => <path key={i} d={`M${x} ${H * 0.92} l14 -46 l14 46z`} />)}
          </g>
          <path d={`M0 ${H * 0.92} Q130 ${H * 0.86} ${W} ${H * 0.9} V${H} H0Z`} fill={p.near} />
        </>
      );
    case 'desert':
      return (
        <>
          <path d={`M0 ${H * 0.7} Q90 ${H * 0.58} 190 ${H * 0.68} T${W} ${H * 0.62} V${H} H0Z`} fill={p.sand} opacity=".85" />
          <path d={`M0 ${H * 0.82} Q120 ${H * 0.72} 240 ${H * 0.8} T${W} ${H * 0.78} V${H} H0Z`} fill={p.sand} />
          <g fill="#2B2420" opacity={p.ink === '#FFFDF9' ? .7 : .85} transform={`translate(230 ${H * 0.7})`}>
            <path d="M0 0 q6 -14 16 -10 q8 -10 18 -2 q6 -6 12 0 l4 -8 l4 2 l-4 12 l0 18 h-3 v-12 h-24 v12 h-3 v-12 q-6 0 -6 -6 l0 18 h-3z" />
          </g>
        </>
      );
    case 'city':
      return (
        <>
          <path d={`M0 ${H * 0.62} Q90 ${H * 0.52} 190 ${H * 0.6} T${W} ${H * 0.56} V${H} H0Z`} fill={p.far} />
          <g fill={p.build}>
            {[[20, 0.5, 46], [70, 0.38, 40], [114, 0.46, 52], [170, 0.3, 36], [210, 0.44, 50], [264, 0.36, 42], [310, 0.5, 58]].map(([x, t, w], i) => (
              <rect key={i} x={x} y={H * t} width={w} height={H} rx="3" />
            ))}
          </g>
          <g className="a-glow" fill={p.win}>
            {[[30, 0.56], [82, 0.44], [126, 0.52], [180, 0.36], [222, 0.5], [276, 0.42], [324, 0.56], [94, 0.54], [236, 0.6], [340, 0.64]].map(([x, t], i) => (
              <rect key={i} x={x} y={H * t} width="8" height="10" rx="2" />
            ))}
          </g>
          <path d={`M0 ${H * 0.86} Q130 ${H * 0.8} ${W} ${H * 0.85} V${H} H0Z`} fill={p.near} />
        </>
      );
    case 'lake':
      return (
        <>
          <path d={`M0 ${H * 0.56} Q60 ${H * 0.42} 130 ${H * 0.52} T260 ${H * 0.48} T${W} ${H * 0.5} V${H * 0.7} H0Z`} fill={p.far} />
          <g fill={p.build}>
            <rect x="80" y={H * 0.48} width="190" height={H * 0.2} rx="5" />
            <rect x="100" y={H * 0.41} width="28" height={H * 0.08} /><circle cx="114" cy={H * 0.41} r="15" />
            <rect x="158" y={H * 0.37} width="34" height={H * 0.12} /><circle cx="175" cy={H * 0.37} r="18" />
            <rect x="222" y={H * 0.42} width="26" height={H * 0.07} /><circle cx="235" cy={H * 0.42} r="13" />
          </g>
          <g className="a-glow" fill={p.win}>
            {[100, 124, 148, 172, 196, 220, 244].map((x) => <rect key={x} x={x} y={H * 0.55} width="9" height="15" rx="4.5" />)}
          </g>
          <rect x="0" y={H * 0.68} width={W} height={H * 0.32} fill={`url(#${wid})`} />
          <rect className="a-rip" x="40" y={H * 0.74} width="80" height="3" rx="1.5" fill="#fff" />
          <rect className="a-rip2" x="220" y={H * 0.79} width="110" height="3" rx="1.5" fill="#fff" />
          <rect className="a-rip" x="130" y={H * 0.86} width="60" height="3" rx="1.5" fill="#fff" />
          <g className="a-bob"><path d={`M160 ${H * 0.76} h44 l-8 10 h-28z`} fill="#2B2420" /><path d={`M181 ${H * 0.76} v-18 l12 18z`} fill="#FFFDF9" /></g>
        </>
      );
    default: // home: hills, road and balloon
      return (
        <>
          <path d={`M0 ${H * 0.64} L60 ${H * 0.51} L110 ${H * 0.58} L170 ${H * 0.47} L230 ${H * 0.56} L290 ${H * 0.49} L350 ${H * 0.55} L${W} ${H * 0.51} V${H} H0Z`} fill={p.far} />
          <path d={`M0 ${H * 0.72} Q80 ${H * 0.6} 170 ${H * 0.68} T${W} ${H * 0.64} V${H} H0Z`} fill={p.mid} />
          <path d={`M0 ${H * 0.83} Q110 ${H * 0.72} 220 ${H * 0.81} T${W} ${H * 0.79} V${H} H0Z`} fill={p.near} />
          <path d={`M210 ${H} C210 ${H * 0.91} 150 ${H * 0.89} 190 ${H * 0.84} C220 ${H * 0.8} 260 ${H * 0.81} 250 ${H * 0.77}`} fill="none" stroke={p.sand} strokeWidth="14" strokeLinecap="round" />
          <g className="a-balloon">
            <path d="M80 170 c-22 0 -34 -18 -34 -36 a34 34 0 0 1 68 0 c0 18 -12 36 -34 36z" fill={accent} />
            <path d="M80 170 c-8 0 -12 -18 -12 -36 c0 -20 6 -34 12 -34 c6 0 12 14 12 34 c0 18 -4 36 -12 36z" fill="#F5EFE6" opacity=".55" />
            <path d="M72 172 l3 12 M88 172 l-3 12" stroke="#2B2420" strokeWidth="1.2" />
            <rect x="74" y="184" width="12" height="9" rx="2" fill="#2B2420" />
          </g>
        </>
      );
  }
}

/** Live animated scene. Changes with time of day, weather and type of place. */
export default function Scene({ timeOfDay = 'afternoon', kind = 'home', weather = 'clear', height = 470, accent = '#B5694A', rounded = 0 }) {
  const id = useId().replace(/:/g, '');
  const p = PALETTES[timeOfDay] || PALETTES.afternoon;
  const H = height;
  const cloudy = weather === 'cloudy' || weather === 'rain' || weather === 'snow';
  const sunOp = cloudy ? p.sun * 0.45 : p.sun;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', borderRadius: rounded }} role="img" aria-label={`${timeOfDay} scene`}>
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
        {[[40, .15], [120, .1], [210, .2], [330, .13], [360, .3], [70, .36]].map(([x, y], i) => (
          <circle key={i} className={i % 2 ? 'a-tw2' : 'a-tw1'} cx={x} cy={H * y} r="1.5" />
        ))}
      </g>
      <g className="a-sun" opacity={sunOp}>
        <circle cx="300" cy={H * p.sunY} r="62" fill="#FFF1C9" opacity=".35" />
        <circle cx="300" cy={H * p.sunY} r="42" fill="#FFF1C9" />
      </g>
      <g opacity={p.moon}>
        <circle cx="300" cy={H * 0.3} r="28" fill="#F4E6C3" />
        <circle cx="313" cy={H * 0.28} r="25" fill={p.s1} />
      </g>
      <g className="a-cloud1" fill="#fff" opacity={cloudy ? Math.max(p.cloud, .6) : p.cloud}>
        <ellipse cx="60" cy={H * 0.25} rx="44" ry="14" /><ellipse cx="82" cy={H * 0.23} rx="24" ry="16" />
      </g>
      <g className="a-cloud2" fill="#fff" opacity={cloudy ? Math.max(p.cloud, .5) : p.cloud * 0.8}>
        <ellipse cx="220" cy={H * 0.16} rx="36" ry="11" /><ellipse cx="234" cy={H * 0.15} rx="18" ry="12" />
      </g>
      {cloudy && (
        <g className="a-cloud2" style={{ animationDuration: '50s' }} fill="#fff" opacity=".6">
          <ellipse cx="140" cy={H * 0.3} rx="52" ry="15" /><ellipse cx="160" cy={H * 0.28} rx="28" ry="18" />
        </g>
      )}
      <Foreground kind={kind} p={p} H={H} accent={accent} wid={`w${id}`} />
      <g className="a-birds" fill="none" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" opacity={timeOfDay === 'night' ? 0 : 1}>
        <path d={`M0 ${H * 0.32} q6 -6 12 0 q6 -6 12 0`} /><path d={`M30 ${H * 0.29} q5 -5 10 0 q5 -5 10 0`} />
      </g>
      {weather === 'rain' && (
        <g className="a-rain" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" opacity=".55">
          {Array.from({ length: 28 }).map((_, i) => (
            <line key={i} x1={(i * 53) % W} y1={(i * 37) % H} x2={((i * 53) % W) - 4} y2={((i * 37) % H) + 12} />
          ))}
        </g>
      )}
    </svg>
  );
}
