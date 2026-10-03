const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  home: <path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  share: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  cloud: <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 17 18z" />,
  rain: <><path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A4 4 0 1 1 17 15z" /><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  reel: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m10 8.5 5 3.5-5 3.5z" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  warn: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></>,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.8-3.5 3-5 6-5s5.2 1.5 6 5M15 15c3 0 5 1.5 6 4.5" /></>,
  bag: <><rect x="5" y="7" width="14" height="13" rx="2" /><path d="M9 7V4h6v3M9 12h6" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h5" /></>,
  food: <path d="M4 11h16a8 8 0 0 1-16 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4" />,
  cafe: <path d="M5 8h12v6a6 6 0 0 1-12 0zM17 10h2a2 2 0 0 1 0 4h-2" />,
  heart: <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />,
  bed: <path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" />,
  star: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5 9-10" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
};

export default function Icon({ name, size = 22, style, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`ic ${className}`} style={style} aria-hidden="true">
      {P[name] || null}
    </svg>
  );
}
