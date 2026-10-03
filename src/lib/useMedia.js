import { useEffect, useState } from 'react';

/** True on laptop/desktop-width screens. */
export function useIsDesktop(query = '(min-width: 900px)') {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const h = () => setMatch(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [query]);
  return match;
}
