import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Menu, X, ChevronDown, HardHat, Coins } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const links = [
    { to: '/feed', label: 'Feed' },
    { to: '/jobs', label: 'Jobs' },
    { to: '/network', label: 'Network' },
    { to: '/bids', label: 'Bids' },
  ]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSignOut() {
    setUserMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const isContractor = profile?.account_type === 'contractor'

  return (
    <nav style={{
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 60, gap: 20 }}>
        {/* Logo */}
        <Link to="/feed" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--color-brand)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HardHat size={18} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-text)', letterSpacing: '-0.5px' }}>
            trayd<span style={{ color: 'var(--color-brand)' }}>book</span>
          </span>
        </Link>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: 280, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Search trades, people, jobs..."
            style={{
              width: '100%',
              padding: '7px 12px 7px 30px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 13,
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              outline: 'none',
            }}
          />
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }} className="nav-links-desktop">
          {links.map(link => {
            const active = location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  background: active ? 'rgba(232,93,38,0.1)' : 'transparent',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Credits badge (non-contractors only) */}
          {profile && !isContractor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(232,93,38,0.1)',
              border: '1px solid rgba(232,93,38,0.2)',
              borderRadius: 100, padding: '4px 10px',
              fontSize: 13, fontWeight: 700, color: 'var(--color-brand)',
              cursor: 'pointer',
            }}
              onClick={() => navigate('/settings/credits')}
            >
              <Coins size={14} />
              {profile.credit_balance}
            </div>
          )}

          {/* Notifications */}
          <button style={{
            background: 'none', border: 'none', padding: 6,
            borderRadius: 8, color: 'var(--color-text-muted)',
            position: 'relative', cursor: 'pointer',
          }}>
            <Bell size={20} />
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 7, height: 7,
              background: 'var(--color-brand)', borderRadius: '50%',
              border: '2px solid var(--color-surface)',
            }} />
          </button>

          {/* User menu */}
          {profile && (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1.5px solid var(--color-border)',
                  borderRadius: 100, padding: '4px 10px 4px 4px',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {initials}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.display_name}
                </span>
                <ChevronDown size={13} color="var(--color-text-muted)" />
              </button>

              {userMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 12, padding: 8, minWidth: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{profile.display_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                      {profile.account_type.replace('_', ' ')}
                    </div>
                  </div>
                  {[
                    { label: 'My Profile', to: '/profile' },
                    { label: 'Settings', to: '/settings' },
                    ...(!isContractor ? [{ label: 'Buy Credits', to: '/settings/credits' }] : []),
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        display: 'block', padding: '8px 12px', borderRadius: 8,
                        fontSize: 14, color: 'var(--color-text)', textDecoration: 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        borderRadius: 8, background: 'none', border: 'none',
                        fontSize: 14, color: '#f87171', cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile toggle */}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: 4, cursor: 'pointer' }}
            onClick={() => setMobileOpen(o => !o)}
            className="mobile-menu-btn"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div style={{
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
          padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 15, fontWeight: 600,
                color: location.pathname.startsWith(link.to) ? 'var(--color-brand)' : 'var(--color-text)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={handleSignOut}
            style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 8,
              background: 'none', border: 'none', fontSize: 15, color: '#f87171',
              fontFamily: 'inherit', cursor: 'pointer', marginTop: 4,
            }}
          >
            Sign Out
          </button>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) { .mobile-menu-btn { display: none !important; } }
        @media (max-width: 767px) { .nav-links-desktop { display: none !important; } }
      `}</style>
    </nav>
  )
}
