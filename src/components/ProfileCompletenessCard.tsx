import { Link } from 'react-router-dom'
import { CheckCircle, Circle, ChevronRight } from 'lucide-react'

interface User {
  avatar_url?: string | null
  social_links?: Record<string, string | null> | null
  phone_number?: string | null
  phone_verified?: boolean | null
}

interface ContractorProfile {
  bio?: string | null
  years_experience?: number | null
  secondary_trades?: string[]
  service_radius_miles?: number | null
  badge_tier?: string | null
  rating_count?: number
  projects_completed?: number
  business_name?: string | null
}

interface Credential {
  status: string
  credential_type?: string
}

interface Props {
  user: User
  cp: ContractorProfile
  credentials: Credential[]
}

interface CheckItem {
  key: string
  label: string
  description: string
  unlocks: string
  done: boolean
  href: string
  weight: number   // impact points (sums to 100)
}

function buildItems(user: User, cp: ContractorProfile, credentials: Credential[]): CheckItem[] {
  const hasLicense = credentials.some(c => c.status === 'active' && c.credential_type !== 'insurance')
  const hasInsurance = credentials.some(c => c.status === 'active' && c.credential_type === 'insurance')
  const hasLinkedIn = !!(user.social_links?.linkedin)

  return [
    {
      key: 'avatar',
      label: 'Upload a profile photo',
      description: 'First impressions count — contractors with photos get more views.',
      unlocks: '+10 Trust Score',
      done: !!user.avatar_url,
      href: '/settings/account',
      weight: 10,
    },
    {
      key: 'bio',
      label: 'Write a bio',
      description: 'Describe your work and specialties (at least 20 characters).',
      unlocks: '+10 Trust Score',
      done: !!cp.bio && cp.bio.trim().length >= 20,
      href: '/settings/profile',
      weight: 10,
    },
    {
      key: 'years',
      label: 'Set years of experience',
      description: 'Shows clients how long you\'ve been in the trade.',
      unlocks: '+5 Trust Score',
      done: !!cp.years_experience && cp.years_experience > 0,
      href: '/settings/profile',
      weight: 5,
    },
    {
      key: 'radius',
      label: 'Set your service area',
      description: 'Confirm the radius you cover so you get matching leads.',
      unlocks: '+5 Trust Score, queue matching',
      done: !!cp.service_radius_miles && cp.service_radius_miles > 0,
      href: '/settings/profile',
      weight: 5,
    },
    {
      key: 'secondary',
      label: 'Add secondary trades',
      description: 'Expand your reach by listing additional specialties.',
      unlocks: '+5 Trust Score, more lead opportunities',
      done: Array.isArray(cp.secondary_trades) && cp.secondary_trades.length > 0,
      href: '/settings/profile',
      weight: 5,
    },
    {
      key: 'business',
      label: 'Add your business name',
      description: 'Looks more professional and builds trust with project owners.',
      unlocks: 'More credible profile',
      done: !!cp.business_name && cp.business_name.trim().length > 0,
      href: '/settings/profile',
      weight: 5,
    },
    {
      key: 'phone',
      label: 'Verify your phone number',
      description: 'Required for SMS lead alerts.',
      unlocks: 'SMS notifications, +credibility',
      done: !!(user.phone_number && user.phone_verified),
      href: '/settings/notifications',
      weight: 5,
    },
    {
      key: 'linkedin',
      label: 'Connect LinkedIn',
      description: 'Helps clients verify your professional background.',
      unlocks: 'Verified social presence',
      done: hasLinkedIn,
      href: '/settings/account',
      weight: 5,
    },
    {
      key: 'license',
      label: 'Add a license credential',
      description: 'Submit your trade license number to earn the Licensed badge.',
      unlocks: 'Licensed badge, +15 Trust Score',
      done: hasLicense,
      href: '/settings/credentials',
      weight: 15,
    },
    {
      key: 'insurance',
      label: 'Add proof of insurance',
      description: 'Verified insurance earns you the Pro Verified badge.',
      unlocks: 'Pro Verified badge, +20 Trust Score',
      done: hasInsurance,
      href: '/settings/credentials',
      weight: 20,
    },
    {
      key: 'review',
      label: 'Earn your first review',
      description: 'Ask a past client to leave a review on your profile.',
      unlocks: '+5 Trust Score, visible star rating',
      done: (cp.rating_count ?? 0) > 0,
      href: '/settings/profile',
      weight: 5,
    },
    {
      key: 'projects5',
      label: 'Log 5 completed projects',
      description: 'Update your project count to show clients your volume.',
      unlocks: '+5 Trust Score',
      done: (cp.projects_completed ?? 0) >= 5,
      href: '/settings/profile',
      weight: 5,
    },
  ]
}

export default function ProfileCompletenessCard({ user, cp, credentials }: Props) {
  const items = buildItems(user, cp, credentials)
  const totalWeight = items.reduce((s, i) => s + i.weight, 0)
  const earnedWeight = items.filter(i => i.done).reduce((s, i) => s + i.weight, 0)
  const pct = Math.round((earnedWeight / totalWeight) * 100)
  const remaining = items.filter(i => !i.done)
  const completed = items.filter(i => i.done)

  const barColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : 'var(--color-brand)'

  return (
    <div
      className="card"
      style={{ padding: '20px 24px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 900,
              fontSize: 18,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 2,
            }}
          >
            Profile Completeness
          </h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {remaining.length === 0
              ? 'Your profile is complete!'
              : `${remaining.length} item${remaining.length !== 1 ? 's' : ''} left to unlock more leads`}
          </p>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontSize: 32,
            fontWeight: 900,
            color: barColor,
            lineHeight: 1,
          }}
        >
          {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 6,
          background: 'var(--color-border)',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {/* Remaining items */}
      {remaining.length > 0 && (
        <div style={{ marginBottom: completed.length > 0 ? 16 : 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              fontFamily: 'var(--font-condensed)',
            }}
          >
            To Do
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {remaining.map(item => (
              <Link
                key={item.key}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  transition: 'background 0.12s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Circle size={16} color="var(--color-border)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                    Unlocks: <span style={{ color: 'var(--color-brand)', fontWeight: 600 }}>{item.unlocks}</span>
                  </div>
                </div>
                <ChevronRight size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Completed items (collapsed summary) */}
      {completed.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 0',
              userSelect: 'none',
            }}
          >
            <CheckCircle size={12} color="#10B981" />
            {completed.length} completed item{completed.length !== 1 ? 's' : ''}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {completed.map(item => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  opacity: 0.6,
                }}
              >
                <CheckCircle size={15} color="#10B981" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--color-text)', textDecoration: 'line-through' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
