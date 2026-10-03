import { useSearchParams, useNavigate } from 'react-router-dom';
import SearchBox, { placeUrl } from '../components/SearchBox.jsx';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';

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

const POPULAR = [
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, region: 'Rajasthan, India' },
  { name: 'Goa', lat: 15.4909, lon: 73.8278, region: 'India' },
  { name: 'Manali', lat: 32.2396, lon: 77.1887, region: 'Himachal Pradesh, India' },
  { name: 'Udaipur', lat: 24.5854, lon: 73.7125, region: 'Rajasthan, India' },
  { name: 'Rishikesh', lat: 30.0869, lon: 78.2676, region: 'Uttarakhand, India' },
  { name: 'Varanasi', lat: 25.3176, lon: 82.9739, region: 'Uttar Pradesh, India' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, region: 'United Arab Emirates' },
  { name: 'Bali', lat: -8.4095, lon: 115.1889, region: 'Indonesia' }
];

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
