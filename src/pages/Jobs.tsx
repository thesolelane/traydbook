import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Briefcase, AlertCircle, TrendingUp, DollarSign, Plus, X, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import JobCard from '../components/JobCard'
import {
  JobListing, TRADE_OPTIONS, CERT_OPTIONS, PAY_RANGE_OPTIONS,
  JOB_TYPE_DISPLAY_OPTIONS, PayRangeOption,
} from '../types/jobs'

type SortMode = 'newest' | 'pay' | 'urgent'

interface Stats {
  totalOpen: number
  postedThisWeek: number
  urgentCount: number
  payLow: number | null
  payHigh: number | null
}

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 140px', minWidth: 130 }}>
      <div style={{ color, background: color + '18', borderRadius: 8, padding: 7, display: 'flex' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export default function Jobs() {
  const { profile } = useAuth()
  const isContractor = profile?.account_type === 'contractor'

  const [listings, setListings] = useState<JobListing[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ totalOpen: 0, postedThisWeek: 0, urgentCount: 0, payLow: null, payHigh: null })

  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [tradeFilters, setTradeFilters] = useState<Set<string>>(new Set())
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set())
  const [payRange, setPayRange] = useState<PayRangeOption | null>(null)
  const [certFilters, setCertFilters] = useState<Set<string>>(new Set())

  const loadListings = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('job_listings')
      .select(`
        *,
        poster:users!poster_id (display_name, handle, avatar_url)
      `)
      .eq('status', 'open')
      .order('is_boosted', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setListings(data as JobListing[])
    setLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [countRes, weekRes, urgentRes, payRes] = await Promise.all([
      supabase.from('job_listings').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('job_listings').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('created_at', weekAgo),
      supabase.from('job_listings').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('is_urgent', true),
      supabase.from('job_listings').select('pay_min, pay_max').eq('status', 'open').not('pay_min', 'is', null),
    ])
    const payData = (payRes.data ?? []) as { pay_min: number; pay_max: number | null }[]
    const allPay = payData.flatMap(r => [r.pay_min, r.pay_max].filter(Boolean) as number[])
    setStats({
      totalOpen: countRes.count ?? 0,
      postedThisWeek: weekRes.count ?? 0,
      urgentCount: urgentRes.count ?? 0,
      payLow: allPay.length ? Math.min(...allPay) : null,
      payHigh: allPay.length ? Math.max(...allPay) : null,
    })
  }, [])

  const loadSaved = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('interaction_events')
      .select('entity_id')
      .eq('user_id', profile.id)
      .eq('event_type', 'job_save')
      .eq('entity_type', 'job_listing')
    if (data) setSavedIds(new Set(data.map((r: { entity_id: string }) => r.entity_id)))
  }, [profile])

  useEffect(() => {
    loadListings()
    loadStats()
    loadSaved()
  }, [loadListings, loadStats, loadSaved])

  async function handleSave(listingId: string) {
    if (!profile) return
    if (savedIds.has(listingId)) return
    setSavedIds(prev => new Set([...prev, listingId]))
    await supabase.from('interaction_events').insert({
      user_id: profile.id,
      event_type: 'job_save',
      entity_id: listingId,
      entity_type: 'job_listing',
    })
  }

  function toggleTrade(trade: string) {
    setTradeFilters(prev => {
      const next = new Set(prev)
      if (next.has(trade)) next.delete(trade)
      else next.add(trade)
      return next
    })
  }

  function toggleType(type: string) {
    setTypeFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function toggleCert(cert: string) {
    setCertFilters(prev => {
      const next = new Set(prev)
      if (next.has(cert)) next.delete(cert)
      else next.add(cert)
      return next
    })
  }

  function clearFilters() {
    setTradeFilters(new Set())
    setTypeFilters(new Set())
    setPayRange(null)
    setCertFilters(new Set())
    setSearch('')
  }

  const hasActiveFilters = tradeFilters.size > 0 || typeFilters.size > 0 || payRange !== null || certFilters.size > 0 || search

  const filtered = listings.filter(l => {
    if (search) {
      const q = search.toLowerCase()
      if (!l.title.toLowerCase().includes(q) &&
          !l.trade_required.toLowerCase().includes(q) &&
          !l.location_city.toLowerCase().includes(q) &&
          !(l.poster?.display_name ?? '').toLowerCase().includes(q)) return false
    }
    if (tradeFilters.size > 0 && !tradeFilters.has(l.trade_required)) return false
    if (typeFilters.size > 0 && !typeFilters.has(l.job_type)) return false
    if (payRange) {
      const pay = l.pay_min ?? l.pay_max ?? 0
      if (payRange.min !== null && pay < payRange.min) return false
      if (payRange.max !== null && pay > payRange.max) return false
    }
    if (certFilters.size > 0) {
      const has = [...certFilters].every(c => l.certs_required.includes(c))
      if (!has) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'urgent') {
      if (a.is_urgent && !b.is_urgent) return -1
      if (!a.is_urgent && b.is_urgent) return 1
    }
    if (sortMode === 'pay') {
      const aPay = a.pay_max ?? a.pay_min ?? 0
      const bPay = b.pay_max ?? b.pay_min ?? 0
      return bPay - aPay
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const payRangeLabel = stats.payLow !== null && stats.payHigh !== null
    ? `$${stats.payLow}–$${stats.payHigh}/hr`
    : '—'

  const SORT_OPTS: { key: SortMode; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'pay', label: 'Pay High-Low' },
    { key: 'urgent', label: 'Urgent First' },
  ]

  const SidebarContent = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, fontSize: 15 }}>Filters</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Clear all
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Job Type
        </div>
        {JOB_TYPE_DISPLAY_OPTIONS.map(opt => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={typeFilters.has(opt.value)}
              onChange={() => toggleType(opt.value)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Trade
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {TRADE_OPTIONS.map(trade => (
            <label key={trade} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={tradeFilters.has(trade)}
                onChange={() => toggleTrade(trade)}
                style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
              />
              {trade}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Pay Range (hourly)
        </div>
        {PAY_RANGE_OPTIONS.map(opt => (
          <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="radio"
              name="payRange"
              checked={payRange?.label === opt.label}
              onChange={() => setPayRange(payRange?.label === opt.label ? null : opt)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Requirements
        </div>
        {CERT_OPTIONS.map(cert => (
          <label key={cert} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={certFilters.has(cert)}
              onChange={() => toggleCert(cert)}
              style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }}
            />
            {cert}
          </label>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 28, color: 'var(--color-text)' }}>Job Board</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3 }}>
            Find jobs, contracts, and subcontracting opportunities in the trades
          </p>
        </div>
        <Link to="/jobs/post" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
          <Plus size={14} /> Post a Job
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox icon={<Briefcase size={14} />} value={stats.totalOpen} label="Open Jobs" color="var(--color-brand)" />
        <StatBox icon={<TrendingUp size={14} />} value={stats.postedThisWeek} label="Posted This Week" color="#059669" />
        <StatBox icon={<AlertCircle size={14} />} value={stats.urgentCount} label="Urgent Listings" color="#DC2626" />
        <StatBox icon={<DollarSign size={14} />} value={payRangeLabel} label="Pay Range" color="#2563EB" />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className="card" style={{
          padding: 20, width: 240, flexShrink: 0,
          display: 'none',
        }}
          id="jobs-sidebar"
        >
          <SidebarContent />
        </div>

        <style>{`
          @media (min-width: 900px) {
            #jobs-sidebar { display: block !important; }
            #jobs-sidebar-toggle { display: none !important; }
          }
        `}</style>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10 }} />
              <input
                type="text"
                placeholder="Search jobs, trades, companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 32px',
                  border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 13, outline: 'none', background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              id="jobs-sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, position: 'relative' }}
            >
              <SlidersHorizontal size={13} /> Filters
              {hasActiveFilters && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-brand)', position: 'absolute', top: 5, right: 5 }} />
              )}
            </button>
          </div>

          {sidebarOpen && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }} id="jobs-sidebar-toggle">
              <SidebarContent />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {SORT_OPTS.map(s => (
              <button
                key={s.key}
                onClick={() => setSortMode(s.key)}
                className={`btn ${sortMode === s.key ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12, padding: '5px 12px' }}
              >
                {s.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>

          {hasActiveFilters && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[...tradeFilters].map(t => (
                <button key={t} onClick={() => toggleTrade(t)} className="badge badge-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {t} <X size={10} />
                </button>
              ))}
              {[...typeFilters].map(t => (
                <button key={t} onClick={() => toggleType(t)} className="badge badge-blue" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {JOB_TYPE_DISPLAY_OPTIONS.find(o => o.value === t)?.label ?? t} <X size={10} />
                </button>
              ))}
              {payRange && (
                <button onClick={() => setPayRange(null)} className="badge badge-green" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {payRange.label} <X size={10} />
                </button>
              )}
              {[...certFilters].map(c => (
                <button key={c} onClick={() => toggleCert(c)} className="badge badge-yellow" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c} <X size={10} />
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
              Loading jobs...
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>No jobs found</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Try adjusting your filters or <button onClick={clearFilters} style={{ color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>clear all</button></p>
              {isContractor ? null : null}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sorted.map(listing => (
                <JobCard
                  key={listing.id}
                  listing={listing}
                  isContractor={isContractor}
                  saved={savedIds.has(listing.id)}
                  onSave={() => handleSave(listing.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
