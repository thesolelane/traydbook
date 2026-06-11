import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DISMISS_KEY = (uid: string) => `ftue_welcome_dismissed_${uid}`

interface Step {
  icon: string
  action: string
  reward: string
  href: string
}

function stepsFor(accountType: string | undefined): Step[] {
  if (accountType === 'contractor') {
    return [
      { icon: '①', action: 'Complete your profile', reward: '+25 credits', href: '/profile/edit' },
      { icon: '②', action: 'Post your first project photo', reward: '+10 credits', href: '/feed' },
      { icon: '③', action: 'Refer a trade pro', reward: '+50 credits', href: '/profile' },
    ]
  }
  if (accountType === 'real_estate_agent') {
    return [
      { icon: '①', action: 'Complete your profile', reward: '+25 credits', href: '/profile/edit' },
      { icon: '②', action: 'Post your first project', reward: '+10 credits', href: '/feed' },
      { icon: '③', action: 'Find a verified contractor', reward: 'Free', href: '/explore' },
    ]
  }
  return [
    { icon: '①', action: 'Complete your profile', reward: '+25 credits', href: '/profile/edit' },
    { icon: '②', action: 'Browse verified contractors', reward: 'Free', href: '/explore' },
    { icon: '③', action: 'Post your first project for bids', reward: 'Free', href: '/bids' },
  ]
}

export default function FtueWelcomeBanner() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    const key = DISMISS_KEY(profile.id)
    if (localStorage.getItem(key)) return
    setVisible(true)
  }, [profile?.id])

  function dismiss() {
    if (!profile?.id) return
    setExiting(true)
    setTimeout(() => {
      localStorage.setItem(DISMISS_KEY(profile.id), '1')
      setVisible(false)
      setExiting(false)
    }, 250)
  }

  if (!visible || !profile) return null

  const steps = stepsFor(profile.account_type)
  const firstName = profile.display_name?.split(' ')[0] ?? 'there'

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(226,114,42,0.12) 0%, rgba(226,114,42,0.04) 100%)',
        border: '1px solid rgba(226,114,42,0.35)',
        borderLeft: '3px solid var(--color-brand)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 18px',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              fontSize: 15,
              color: 'var(--color-text)',
              letterSpacing: '0.2px',
              marginBottom: 4,
            }}
          >
            Welcome to TraydBook, {firstName}! Here's how to get started
          </div>
          <p
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              margin: '0 0 12px',
              lineHeight: 1.5,
            }}
          >
            Complete these steps to earn your first credits and unlock the full platform.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {steps.map(step => (
              <Link
                key={step.action}
                to={step.href}
                onClick={dismiss}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 7,
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-brand)',
                      minWidth: 18,
                    }}
                  >
                    {step.icon}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>
                    {step.action}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: step.reward.startsWith('+')
                        ? 'var(--color-brand)'
                        : 'var(--color-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.reward}
                  </span>
                  <ArrowRight size={12} color="var(--color-text-muted)" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            lineHeight: 1,
          }}
          title="Dismiss"
          aria-label="Dismiss welcome banner"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
