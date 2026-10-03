import { useId } from 'react';

const Land = ({ x }) => (
  <g transform={`translate(${x} 0)`}>
    <path d="M0 34 q8 -12 18 -5 q7 6 -1 13 q-9 6 -17 -8z" fill="#B5694A" />
    <path d="M22 56 q10 -7 16 4 q4 11 -6 17 q-11 2 -10 -21z" fill="#E9C46A" />
    <path d="M44 26 q11 -5 17 4 q2 9 -9 9 q-10 0 -8 -13z" fill="#B5694A" />
    <path d="M52 58 q9 -3 11 6 q0 9 -9 7z" fill="#8FA585" />
    <path d="M64 40 q8 -3 12 3 q2 7 -6 7 q-7 0 -6 -10z" fill="#E9C46A" />
  </g>
);

// Wanderpin's spinning globe: brand colours, not a real-world map.
export default function Globe({ size = 40, stroke }) {
  const id = useId().replace(/:/g, '');
  const small = typeof size === 'number' && size < 80;
  const sw = stroke ?? (small ? 3 : 2.2);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={`g${id}`}><circle cx="50" cy="50" r="38" /></clipPath>
      </defs>
      <ellipse className="a-orbit" cx="50" cy="50" rx="49" ry="15" fill="none" stroke="#2B2420"
        strokeWidth={small ? 1.6 : 1.2} strokeDasharray="3 5" opacity=".45" transform="rotate(-18 50 50)" />
      <circle cx="50" cy="50" r="38" fill="#7FA6A3" />
      <g clipPath={`url(#g${id})`}>
        <g className="a-gspin"><Land x={12} /><Land x={92} /></g>
        <ellipse cx="38" cy="34" rx="14" ry="9" fill="#FFFDF9" opacity=".22" />
        <path d="M66 20 a38 38 0 0 1 0 60 a30 38 0 0 0 0 -60z" fill="#2B2420" opacity=".12" />
      </g>
      <circle cx="50" cy="50" r="38" fill="none" stroke="#2B2420" strokeWidth={sw} />
    </svg>
  );
}
