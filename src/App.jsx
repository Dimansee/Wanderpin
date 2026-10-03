import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav.jsx';
import Loader from './components/Loader.jsx';
import Home from './pages/Home.jsx';
import Place from './pages/Place.jsx';
import Find from './pages/Find.jsx';
import Saved from './pages/Saved.jsx';
import { TripsList, TripDetail } from './pages/Trips.jsx';
import Import from './pages/Import.jsx';
import Packing from './pages/Packing.jsx';
import Profile from './pages/Profile.jsx';
import { ToastContext } from './lib/store.js';

export default function App() {
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const { pathname } = useLocation();

  useEffect(() => {
    // Show the globe for a moment while fonts load, then fly it to the corner
    const min = new Promise((r) => setTimeout(r, 1200));
    Promise.all([document.fonts?.ready, min]).then(() => setReady(true));
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(window.__wpToast);
    window.__wpToast = setTimeout(() => setToastMsg(''), 2200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/place" element={<Place />} />
          <Route path="/find" element={<Find />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/trips" element={<TripsList />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/import" element={<Import />} />
          <Route path="/packing" element={<Packing />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <BottomNav />
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
      <Loader ready={ready} />
    </ToastContext.Provider>
  );
}
