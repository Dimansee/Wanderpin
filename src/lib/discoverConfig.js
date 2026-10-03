// Shared by the browser and the /api/discover function.

// Results are shared per grid cell of CELL degrees (~22 km north–south).
export const CELL = 0.2;
export const DISCOVER_VERSION = 2; // bump to regenerate all saved picks
export const FRESH_DAYS = 30;     // after this, picks are regenerated on the next search
export const REFRESH_DAYS = 7;    // users may ask for a refresh once picks are this old

export const DISCOVER_CATS = {
  food:   { label: 'Food trails',      icon: 'food',   ai: 'street food stalls, iconic local eateries, legendary snack joints and sweet shops that a food-trail traveller must try' },
  cafe:   { label: 'Cafe hopping',     icon: 'cafe',   ai: 'aesthetic, cosy or work-friendly cafes worth visiting, with great coffee, desserts or views' },
  couple: { label: 'Couple spots',     icon: 'heart',  ai: 'romantic spots for couples: sunset viewpoints, quiet gardens, lakesides, rooftops and pretty walks' },
  sight:  { label: 'Popular spots',    icon: 'star',   ai: 'the must-see sights and famous attractions most visitors go to' },
  family: { label: 'Family dining',    icon: 'food',   ai: 'family-friendly restaurants with good food, seating space and a relaxed vibe for all ages' },
  busy:   { label: 'Busy and buzzing', icon: 'people', ai: 'lively, crowded places: famous markets, bazaars, malls, promenades and popular hangouts' },
  quiet:  { label: 'Skip the crowds',  icon: 'route',  ai: 'calm, uncrowded places to relax: peaceful parks, gardens, viewpoints and hidden gems' },
  stay:   { label: 'Stays',            icon: 'bed',    ai: 'well-located hotels, guest houses and hostels for travellers across budgets' }
};

export function cellOf(lat, lon) {
  const i = Math.floor(lat / CELL);
  const j = Math.floor(lon / CELL);
  return { i, j, center: { lat: +((i + 0.5) * CELL).toFixed(4), lon: +((j + 0.5) * CELL).toFixed(4) } };
}

export function discoverKey(cat, lat, lon) {
  const { i, j } = cellOf(lat, lon);
  return `${cat}_${i}_${j}`;
}
