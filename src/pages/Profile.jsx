import { useEffect, useState } from 'react';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { useUser, useCollection } from '../lib/store.js';
import { signInWithGoogle, logOut, firebaseReady } from '../lib/firebase.js';

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

export default function Profile() {
  const { user } = useUser();
  const trips = useCollection('trips');
  const saves = useCollection('saves');
  const notes = useCollection('notes');
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [err, setErr] = useState('');
  const installed = window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e) => { e.preventDefault(); deferredPrompt = e; setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <div className="page">
      <TopBar title="Profile" back={false} />

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18 }}>
        {user ? (
          <>
            <div className="row" style={{ gap: 12 }}>
              {user.photoURL ? <img src={user.photoURL} alt="" width="52" height="52" style={{ borderRadius: 26 }} referrerPolicy="no-referrer" /> : <span className="icon-btn"><Icon name="user" /></span>}
              <div className="grow"><b style={{ fontSize: 17 }}>{user.displayName || 'Traveller'}</b><div className="sub">{user.email}</div></div>
            </div>
            <div className="sub">Your trips, saves and notes sync across all your devices.</div>
            <button className="btn ghost" onClick={logOut}><Icon name="logout" size={18} />Log out</button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22 }}>Save your trips everywhere</h2>
            <div className="sub">You can use Wanderpin without an account. Everything is saved on this device. Sign in to keep it safe and use it on your phone and laptop.</div>
            {firebaseReady ? (
              <button className="btn" onClick={() => signInWithGoogle().catch((e) => setErr(e.message))}>Continue with Google</button>
            ) : (
              <div className="alert tip" style={{ fontSize: 14 }}>Login isn't switched on yet. Add your Firebase keys (see README) to enable it.</div>
            )}
            {err && <div className="alert" style={{ fontSize: 14 }}>{err}</div>}
          </>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[['Trips', trips.length], ['Saved', saves.length], ['Notes', notes.length]].map(([l, n]) => (
          <div key={l} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700 }}>{n}</div>
            <div className="sub" style={{ fontSize: 13 }}>{l}</div>
          </div>
        ))}
      </div>

      {!installed && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b style={{ fontSize: 16 }}>Get the app</b>
          {canInstall ? (
            <>
              <div className="sub">Install Wanderpin on your home screen. On Android you can then share reels straight from Instagram to Wanderpin.</div>
              <button className="btn accent" onClick={async () => { deferredPrompt?.prompt(); await deferredPrompt?.userChoice; deferredPrompt = null; setCanInstall(false); }}>Install Wanderpin</button>
            </>
          ) : isIOS ? (
            <div className="sub">On iPhone: tap the Share button in Safari, then "Add to Home Screen". To import a reel, copy its link and paste it in Wanderpin.</div>
          ) : (
            <div className="sub">Open your browser menu and choose "Install app" or "Add to Home screen".</div>
          )}
        </section>
      )}

      <section className="card sub" style={{ fontSize: 13, lineHeight: 1.6 }}>
        Wanderpin uses free, open data: travel guides from Wikivoyage (CC BY-SA), places from OpenStreetMap contributors, weather and time from Open-Meteo. Crowd levels are estimates plus live check-ins from travellers.
      </section>
    </div>
  );
}
