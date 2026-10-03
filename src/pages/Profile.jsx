import { useEffect, useState } from 'react';
import { TopBar } from '../components/bits.jsx';
import Icon from '../components/Icon.jsx';
import { useUser, useCollection } from '../lib/store.js';
import { useAdmin } from '../lib/admin.js';
import { Link } from 'react-router-dom';
import { signInWithGoogle, logOut, firebaseReady, signInWithEmail, signUpWithEmail, resetPassword, authMessage } from '../lib/firebase.js';

function SignIn() {
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'error' | 'ok', text }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signup') await signUpWithEmail(name, email, password);
      else if (mode === 'signin') await signInWithEmail(email, password);
      else { await resetPassword(email); setMsg({ type: 'ok', text: 'Check your inbox for a link to set a new password.' }); }
    } catch (err) {
      setMsg({ type: 'error', text: authMessage(err) });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn" onClick={() => signInWithGoogle().catch((err) => setMsg({ type: 'error', text: authMessage(err) }))}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </button>
      <div className="row" style={{ gap: 10, color: 'var(--muted)', fontSize: 13 }}>
        <span className="grow" style={{ height: 1, background: 'var(--line)' }} />or use email<span className="grow" style={{ height: 1, background: 'var(--line)' }} />
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'signup' && <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" autoComplete="name" />}
        <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoComplete="email" required />
        {mode !== 'reset' && (
          <input className="field" type="password" placeholder={mode === 'signup' ? 'Create a password (6+ characters)' : 'Password'} value={password}
            onChange={(e) => setPassword(e.target.value)} aria-label="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} />
        )}
        <button className="btn accent" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>
      </form>
      {msg && <div className={`alert ${msg.type === 'ok' ? 'tip' : ''}`} style={{ fontSize: 14 }}>{msg.text}</div>}
      <div className="row wrap" style={{ justifyContent: 'space-between', fontSize: 14 }}>
        {mode === 'signin' && <>
          <button type="button" className="linkish" onClick={() => { setMode('signup'); setMsg(null); }}>New here? Create an account</button>
          <button type="button" className="linkish" onClick={() => { setMode('reset'); setMsg(null); }}>Forgot password?</button>
        </>}
        {mode !== 'signin' && <button type="button" className="linkish" onClick={() => { setMode('signin'); setMsg(null); }}>Already have an account? Sign in</button>}
      </div>
    </div>
  );
}

function AdminLink() {
  const { isAdmin } = useAdmin();
  if (!isAdmin) return null;
  return <Link to="/admin" className="btn" style={{ textDecoration: 'none' }}><Icon name="pencil" size={18} />Open admin panel</Link>;
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

export default function Profile() {
  const { user } = useUser();
  const trips = useCollection('trips');
  const saves = useCollection('saves');
  const notes = useCollection('notes');
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
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
            <AdminLink />
            <button className="btn ghost" onClick={logOut}><Icon name="logout" size={18} />Log out</button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22 }}>Save your trips everywhere</h2>
            <div className="sub">You can use Wanderpin without an account. Everything is saved on this device. Sign in to keep it safe and use it on your phone and laptop.</div>
            {firebaseReady ? <SignIn /> : (
              <div className="alert tip" style={{ fontSize: 14 }}>Login isn't switched on yet. Add your Firebase keys (see README) to enable it.</div>
            )}
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
