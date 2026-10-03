import { useSearchParams, useNavigate } from 'react-router-dom';
import SearchBox, { placeUrl } from '../components/SearchBox.jsx';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { DESTINATIONS } from '../lib/destinations.js';

const HEADINGS = {
  scams: ['Scam alerts', 'Which city are you heading to?'],
  overview: ['Weather and time', 'Check any place, right now'],
  busy: ['Crowd check', 'Where do you want to go?'],
  couple: ['Couple spots', 'In which city?'],
  food: ['Food trails', 'In which city?'],
  cafe: ['Cafe hopping', 'In which city?'],
  sight: ['Popular spots', 'In which city?'],
  family: ['Family dining', 'In which city?'],
  stay: ['Stays', 'In which city?'],
  quiet: ['Skip the crowds', 'In which city?']
};

const POPULAR = DESTINATIONS;

export default function Find() {
  const [params] = useSearchParams();
  const tab = params.get('tab') || undefined;
  const nav = useNavigate();
  const [title, sub] = HEADINGS[tab] || ['Explore a place', 'Search a city, town or landmark'];
  return (
    <div className="page">
      <TopBar />
      <div>
        <h1 style={{ fontSize: 34 }}>{title}</h1>
        <div className="sub" style={{ marginTop: 4 }}>{sub}</div>
      </div>
      <SearchBox tab={tab} autoFocus />
      <section className="section">
        <h2>Popular right now</h2>
        <div className="row wrap">
          {POPULAR.map((p) => (
            <button key={p.name} className="chip row" style={{ gap: 6 }} onClick={() => nav(placeUrl(p, tab))}><Icon name="pin" size={16} />{p.name}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
