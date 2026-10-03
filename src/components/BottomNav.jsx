import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';

const link = (to, label, icon) => (
  <NavLink to={to} end aria-label={label} className={({ isActive }) => (isActive ? 'active' : '')} style={({ isActive }) => ({
    color: isActive ? 'var(--paper)' : '#BFB2A3', width: 44, height: 44, textDecoration: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  })}>
    <Icon name={icon} />
    <span className="nav-label">{label}</span>
  </NavLink>
);

// Floating bar: bottom of the screen on phones, top-centre on computers
export default function BottomNav() {
  return (
    <nav className="wp-nav" aria-label="Main" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom))',
      width: 'calc(100% - 32px)', maxWidth: 528, height: 'var(--nav-h)', borderRadius: 34, background: 'var(--ink)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 50,
      boxShadow: '0 10px 30px rgba(43,36,32,.25)'
    }}>
      {link('/', 'Home', 'home')}
      {link('/saved', 'Saved', 'bookmark')}
      <NavLink to="/import" aria-label="Plan from a reel" className="reel" style={{
        color: 'var(--paper)', width: 52, height: 52, borderRadius: 26, background: 'var(--accent)', textDecoration: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}><Icon name="plus" /><span className="nav-label">Plan from a reel</span></NavLink>
      {link('/trips', 'Trips', 'map')}
      {link('/profile', 'Profile', 'user')}
    </nav>
  );
}
