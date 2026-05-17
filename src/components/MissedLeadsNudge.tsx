import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingDown, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface MissedData {
  missed: number
  trade: string
  trust_score: number
  badge_tier: string | null
}

const DISMISS_KEY = 'missed_leads_dismissed_at'
const REDISPLAY_HOURS = 24

export default function MissedLeadsNudge() {
  const [data, setData] = useState<MissedData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const hrs = (Date.now() - parseInt(dismissedAt, 10)) / 3600000
      if (hrs < REDISPLAY_HOURS) {
        setDismissed(true)
        return
      }
    }
    void load()
  }, [])

  async function load() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/contractor/missed-leads', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return
    const json: MissedData = await res.json()
    if (json.missed > 0) {
      setData(json)
      setVisible(true)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
    setTimeout(() => setDismissed(true), 300)
  }

  if (dismissed || !visible || !data) return null

  const hasLowScore = data.trust_score < 40
  const needsBadge = !data.badge_tier
  const primaryCta = hasLowScore
    ? { label: 'Complete your profile', href: '/profile' }
    : needsBadge
      ? { label: 'Add a credential', href: '/settings/credentials' }
      : { label: 'Browse open RFQs', href: '/bids' }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        border: '1px solid #334155',
        borderLeft: '3px solid #F97316',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <TrendingDown size={20} color="#F97316" style={{ flexShrink: 0, marginTop: 1 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            color: '#F8FAFC',
            letterSpacing: '0.2px',
          }}
        >
          {data.missed} {data.trade} project{data.missed !== 1 ? 's' : ''} went to other contractors
          this month
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 3, lineHeight: 1.5 }}>
          {hasLowScore
            ? `Your Trust Score is ${data.trust_score} — a higher score moves you up the queue so you see new RFQs sooner.`
            : needsBadge
              ? 'Adding a verified credential earns you a badge and improves your queue position for new RFQs.'
              : 'Stay active — bid on open RFQs to keep winning work in your trade.'}
        </p>

        <div
          style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Link
            to={primaryCta.href}
            className="btn btn-primary"
            style={{
              fontSize: 12,
              padding: '6px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={dismiss}
          >
            {primaryCta.label} <ArrowRight size={12} />
          </Link>
          {hasLowScore && (
            <Link
              to="/profile"
              onClick={dismiss}
              style={{
                fontSize: 12,
                color: '#94A3B8',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              View completeness guide <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>

      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          color: '#64748B',
          flexShrink: 0,
          lineHeight: 1,
        }}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  )
}
