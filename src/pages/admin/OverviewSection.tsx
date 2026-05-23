import { useState, useEffect, useRef } from 'react'
import {
  Users,
  BarChart2,
  Shield,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Minus,
  Activity,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { StatCard, SectionCard, SectionProps } from './shared'

const POLL_INTERVAL = 15_000

type ActivityEvent = {
  type: 'signup' | 'post' | 'bid' | 'job'
  id?: string
  email?: string
  confirmed?: boolean
  onboarded?: boolean
  display_name?: string | null
  account_type?: string | null
  post_type?: string
  created_at: string
}

type ActivityFeed = {
  events: ActivityEvent[]
  signups_total: number
  signups_onboarded: number
  signups_incomplete: number
  posts_total: number
  bids_total: number
  jobs_total: number
  hours: number
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function eventLabel(e: ActivityEvent) {
  if (e.type === 'signup') {
    const who = e.display_name ?? e.email ?? e.id?.slice(0, 8)
    const status = e.onboarded
      ? `· ${e.account_type ?? 'onboarded'}`
      : e.confirmed
      ? '· confirmed, not onboarded'
      : '· unconfirmed'
    return `New signup: ${who} ${status}`
  }
  if (e.type === 'post') return `New post · ${e.post_type ?? 'post'}`
  if (e.type === 'bid') return 'New bid submitted'
  if (e.type === 'job') return 'New job listing'
  return 'Activity'
}

function eventColor(e: ActivityEvent) {
  if (e.type === 'signup') {
    if (e.onboarded) return '#10b981'
    if (e.confirmed) return '#f59e0b'
    return '#6b7280'
  }
  if (e.type === 'post') return '#7c3aed'
  if (e.type === 'bid') return '#0891b2'
  if (e.type === 'job') return '#059669'
  return 'var(--color-text-muted)'
}

function EventIcon({ e }: { e: ActivityEvent }) {
  const size = 14
  if (e.type === 'signup') {
    return e.onboarded
      ? <CheckCircle2 size={size} />
      : <UserPlus size={size} />
  }
  return <Activity size={size} />
}

export default function OverviewSection({ authHeaders }: SectionProps) {
  const [stats, setStats] = useState<{
    totalUsers: number
    adminCount: number
    contractorCount: number
    ownerCount: number
    postCount: number
    jobCount: number
    rfqCount: number
    bidCount: number
    totalCreditsIssued: number
    totalCreditSpent: number
    recentSignups: number
  } | null>(null)

  const [feed, setFeed] = useState<ActivityFeed | null>(null)
  const [feedHours, setFeedHours] = useState(2)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [err, setErr] = useState('')
  const [feedErr, setFeedErr] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [pulse, setPulse] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load stats')
      setStats(await res.json())
      setErr('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  async function loadFeed(hours = feedHours) {
    setFeedLoading(true)
    try {
      const res = await fetch(`/api/admin/monitor/activity?hours=${hours}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load activity')
      setFeed(await res.json())
      setFeedErr('')
      setLastRefresh(new Date())
      setPulse(true)
      setTimeout(() => setPulse(false), 600)
    } catch (e) {
      setFeedErr(e instanceof Error ? e.message : 'Failed to load activity')
    } finally {
      setFeedLoading(false)
    }
  }

  function startPolling() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      void loadStats()
      void loadFeed(feedHours)
    }, POLL_INTERVAL)
  }

  useEffect(() => {
    void loadStats()
    void loadFeed(feedHours)
    startPolling()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    void loadFeed(feedHours)
    startPolling()
  }, [feedHours])

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '16px 20px',
              height: 90,
            }}
          />
        ))}
      </div>
    )
  }

  if (err) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8,
          color: '#DC2626',
          fontSize: 13,
        }}
      >
        {err}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          sub={`${stats?.recentSignups ?? 0} in last 30d`}
          icon={<Users size={18} />}
        />
        <StatCard
          label="Contractors"
          value={stats?.contractorCount ?? 0}
          icon={<TrendingUp size={18} />}
          color="#D97706"
        />
        <StatCard
          label="Owners / Homeowners"
          value={stats?.ownerCount ?? 0}
          icon={<Users size={18} />}
          color="#2563EB"
        />
        <StatCard
          label="Admins"
          value={stats?.adminCount ?? 0}
          icon={<Shield size={18} />}
          color="#E85D04"
        />
        <StatCard
          label="Total Posts"
          value={stats?.postCount ?? 0}
          icon={<MessageSquare size={18} />}
          color="#7C3AED"
        />
        <StatCard
          label="Job Listings"
          value={stats?.jobCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#059669"
        />
        <StatCard
          label="RFQs Posted"
          value={stats?.rfqCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#0891B2"
        />
        <StatCard
          label="Bids Submitted"
          value={stats?.bidCount ?? 0}
          icon={<BarChart2 size={18} />}
          color="#E85D04"
        />
        <StatCard
          label="Credits Issued"
          value={stats?.totalCreditsIssued ?? 0}
          icon={<DollarSign size={18} />}
          color="#059669"
        />
        <StatCard
          label="Credits Spent"
          value={stats?.totalCreditSpent ?? 0}
          icon={<Minus size={18} />}
          color="#DC2626"
        />
      </div>

      <SectionCard
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: pulse ? '#10b981' : '#6b7280',
                display: 'inline-block',
                transition: 'background 0.3s',
                boxShadow: pulse ? '0 0 0 3px rgba(16,185,129,0.25)' : 'none',
              }}
            />
            Live Activity
            {lastRefresh && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                · refreshed {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </span>
        }
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={feedHours}
              onChange={e => setFeedHours(Number(e.target.value))}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <option value={1}>Last 1h</option>
              <option value={2}>Last 2h</option>
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={72}>Last 3d</option>
            </select>
            <button
              onClick={() => { void loadStats(); void loadFeed(feedHours) }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
              title="Refresh now"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        }
      >
        {feed && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {[
              { label: 'Signups', value: feed.signups_total, color: 'var(--color-brand)' },
              { label: 'Onboarded', value: feed.signups_onboarded, color: '#10b981' },
              { label: 'Incomplete', value: feed.signups_incomplete, color: '#f59e0b' },
              { label: 'Posts', value: feed.posts_total, color: '#7c3aed' },
              { label: 'Bids', value: feed.bids_total, color: '#0891b2' },
              { label: 'Jobs', value: feed.jobs_total, color: '#059669' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', minWidth: 60 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily: 'var(--font-condensed)',
                    color: s.color,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {feedErr && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#DC2626',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={13} />
            {feedErr}
          </div>
        )}

        {feedLoading && !feed ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Loading activity…</div>
        ) : feed?.events.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            No activity in the last {feed.hours}h
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {(feed?.events ?? []).slice(0, 30).map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i < (feed?.events.length ?? 0) - 1
                    ? '1px solid var(--color-border)'
                    : 'none',
                }}
              >
                <span style={{ color: eventColor(e), flexShrink: 0 }}>
                  <EventIcon e={e} />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text)',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {eventLabel(e)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {timeAgo(e.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={10} />
          Auto-refreshes every {POLL_INTERVAL / 1000}s · Signups include auth-level (even incomplete onboarding)
        </div>
      </SectionCard>
    </div>
  )
}
