import { useEffect, useState } from 'react';
import { getWeather, localTime } from './api.js';
import { timeOfDayFromHour } from '../components/Scene.jsx';

/** Weather + local clock for a place, ticking every minute. */
export function useLiveConditions(lat, lon) {
  const [weather, setWeather] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lat == null || lon == null) { setWeather(null); return; }
    let alive = true;
    getWeather(lat, lon).then((w) => alive && setWeather(w)).catch(() => alive && setWeather(null));
    return () => { alive = false; };
  }, [lat, lon]);

  const tz = weather?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clock = localTime(tz, now);
  return { weather, clock, timeOfDay: timeOfDayFromHour(clock.hour) };
}
