import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HardHat, Bell, Search, Menu, X } from 'lucide-react';
import { currentUser } from '../data/mockData';

export default function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/', label: 'Feed' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/network', label: 'Network' },
    { to: '/bids', label: 'My Bids' },
    { to: '/profile', label: 'Profile' },
  ];

  return (
    <nav style={{
      background: 'white',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 60, gap: 24 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--color-brand)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HardHat size={20} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
            trayd<span style={{ color: 'var(--color-brand)' }}>book</span>
          </span>
        </Link>

        <div style={{ flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={15} color="var(--color-text-light)" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Search jobs, people, trades..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              background: 'var(--color-bg)',
              outline: 'none',
              color: 'var(--color-text)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }} className="nav-links-desktop">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 14,
                fontWeight: 600,
                color: location.pathname === link.to ? 'var(--color-brand)' : 'var(--color-text-muted)',
                background: location.pathname === link.to ? 'var(--color-brand-light)' : 'transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button style={{
            background: 'none',
            border: 'none',
            padding: 6,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
            position: 'relative',
          }}>
            <Bell size={20} />
            <span style={{
              position: 'absolute',
              top: 4, right: 4,
              width: 8, height: 8,
              background: 'var(--color-brand)',
              borderRadius: '50%',
              border: '2px solid white',
            }} />
          </button>

          <Link to="/profile">
            <div style={{
              width: 34, height: 34,
              background: currentUser.avatarColor,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              color: 'white',
              cursor: 'pointer',
            }}>
              {currentUser.initials}
            </div>
          </Link>

          <button
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: 4 }}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="mobile-menu-btn"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{
          background: 'white',
          borderTop: '1px solid var(--color-border)',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 15,
                fontWeight: 600,
                color: location.pathname === link.to ? 'var(--color-brand)' : 'var(--color-text)',
                background: location.pathname === link.to ? 'var(--color-brand-light)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 767px) {
          .nav-links-desktop { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
