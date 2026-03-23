import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Menu, X, ChevronDown, Coins, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function TraydBookLogo({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 32 : 26
  const fontSize = size === 'md' ? 28 : 22
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size === 'md' ? 10 : 8 }}>
      <div style={{
        width: iconSize, height: iconSize,
        background: 'var(--color-brand)',
        borderRadius: size === 'md' ? 7 : 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg viewBox="0 0 17 17" fill="none" width={iconSize * 0.6} height={iconSize * 0.6}>
          <rect x="2" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="1.2" />
          <rect x="5" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.2" />
          <path d="M7 6h4M7 9h3M7 12h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-condensed)',
        fontSize, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1,
      }}>
        <span style={{ color: 'var(--color-text)' }}>Trayd</span>
        <span style={{ color: 'var(--color-brand)' }}>Book</span>
      </span>
    </div>
  )
}

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
  // Only project_owner and agent can post RFQs (homeowner uses a different flow)
  const canPostRfq = profile?.account_type === 'project_owner' || profile?.account_type === 'agent'

  return (
    <nav style={{
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', height: 56, gap: 20 }}>
        <Link to="/feed" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <TraydBookLogo />
        </Link>

        <div style={{ flex: 1, maxWidth: 260, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={13} color="var(--color-text-light)" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
          <input
            type="search"
            placeholder="Search trades, people, jobs..."
            style={{
              width: '100%', padding: '6px 12px 6px 28px',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
              fontSize: 13, background: 'var(--color-bg)', color: 'var(--color-text)',
              outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 2, flex: 1, justifyContent: 'center' }} className="nav-links-desktop">
          {links.map(link => {
            const active = location.pathname.startsWith(link.to)
            return (
              <Link key={link.to} to={link.to} style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-condensed)',
                fontSize: 14, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
                color: active ? 'var(--color-brand)' : 'var(--color-text-muted)',
                background: active ? 'var(--color-brand-light)' : 'transparent',
                whiteSpace: 'nowrap', textDecoration: 'none', transition: 'all 0.15s',
              }}>
                {link.label}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {profile && isContractor && (
            <Link to="/feed/post" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--color-brand)',
              border: 'none',
              borderRadius: 'var(--radius-md)', padding: '6px 14px',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: '#fff', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              <Plus size={13} /> Post Work
            </Link>
          )}
          {profile && canPostRfq && (
            <Link to="/bids/new" style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--color-brand)',
              border: 'none',
              borderRadius: 'var(--radius-md)', padding: '6px 14px',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: '#fff', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              <Plus size={13} /> Post RFQ
            </Link>
          )}
          {profile && !isContractor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--color-brand-light)',
              border: '1px solid rgba(232,93,4,0.2)',
              borderRadius: 3, padding: '4px 10px',
              fontFamily: 'var(--font-condensed)',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--color-brand)', cursor: 'pointer',
            }} onClick={() => navigate('/settings/credits')}>
              <Coins size={13} />{profile.credit_balance} credits
            </div>
          )}

          <button style={{
            background: 'none', border: '1px solid var(--color-border)', padding: '5px 7px',
            borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)',
            position: 'relative', cursor: 'pointer',
          }}>
            <Bell size={16} />
            <span style={{
              position: 'absolute', top: 3, right: 3,
              width: 6, height: 6,
              background: 'var(--color-brand)', borderRadius: '50%',
              border: '1.5px solid var(--color-surface)',
            }} />
          </button>

          {profile && (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setUserMenuOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', padding: '4px 10px 4px 4px',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                }}>
                  {initials}
                </div>
                <span style={{
                  fontFamily: 'var(--font-condensed)',
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                  color: 'var(--color-text)', maxWidth: 100,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {profile.display_name}
                </span>
                <ChevronDown size={12} color="var(--color-text-light)" />
              </button>

              {userMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: 6, minWidth: 200,
                  boxShadow: 'var(--shadow-lg)', zIndex: 200,
                }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
                    <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                      {profile.display_name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 11, color: 'var(--color-text-light)', marginTop: 2, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      {profile.account_type.replace('_', ' ')}
                    </div>
                  </div>
                  {[
                    { label: 'My Profile', to: '/profile' },
                    { label: 'Settings', to: '/settings' },
                    ...(!isContractor ? [{ label: 'Buy Credits', to: '/settings/credits' }] : []),
                  ].map(item => (
                    <Link key={item.to} to={item.to} onClick={() => setUserMenuOpen(false)} style={{
                      display: 'block', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-condensed)',
                      fontSize: 13, fontWeight: 600, letterSpacing: '0.3px',
                      color: 'var(--color-text)', textDecoration: 'none', transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
                    <button onClick={handleSignOut} style={{
                      width: '100%', textAlign: 'left', padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)', background: 'none', border: 'none',
                      fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 600,
                      letterSpacing: '0.3px', color: '#e05252', cursor: 'pointer', transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: 4, cursor: 'pointer' }}
            onClick={() => setMobileOpen(o => !o)}
            className="mobile-menu-btn"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{
          background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
          padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {links.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={{
              padding: '9px 10px', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              color: location.pathname.startsWith(link.to) ? 'var(--color-brand)' : 'var(--color-text)',
              textDecoration: 'none',
            }}>
              {link.label}
            </Link>
          ))}
          <button onClick={handleSignOut} style={{
            textAlign: 'left', padding: '9px 10px', borderRadius: 'var(--radius-md)',
            background: 'none', border: 'none',
            fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600,
            letterSpacing: '0.5px', textTransform: 'uppercase',
            color: '#e05252', cursor: 'pointer', marginTop: 4,
          }}>
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

export { TraydBookLogo }
