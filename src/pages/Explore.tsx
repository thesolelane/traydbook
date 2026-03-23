import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Star, MapPin, Briefcase, CheckCircle, MessageSquare, UserPlus, UserCheck, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TRADE_OPTIONS = [
  'Carpentry', 'Concrete', 'Drywall', 'Electrical',
  'Engineering', 'General Contractor', 'HVAC', 'Masonry', 'Painting',
  'Plumbing', 'Roofing', 'Steel/Ironwork', 'Tile', 'Other',
]

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '4.0+', value: 4 },
  { label: '4.5+', value: 4.5 },
  { label: '4.8+', value: 4.8 },
]

const AVAIL_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Available', value: 'available' },
  { label: 'Busy', value: 'busy' },
]

interface ContractorRow {
  id: string
  user_id: string
  primary_trade: string
  business_name: string | null
  bio: string | null
  years_experience: number
  rating_avg: number
  rating_count: number
  projects_completed: number
  availability_status: string
  available_from: string | null
  user: { display_name: string; handle: string; avatar_url: string | null; location_city: string | null; location_state: string | null }
  credentials: { id: string; verified_at: string | null }[]
}

interface ConnectionState { [userId: string]: 'none' | 'pending' | 'accepted' }

const MSG_COLD_COST = 3

function threadId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_')
}

export default function Explore() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isContractor = profile?.account_type === 'contractor'

  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<ConnectionState>({})
  const [connecting, setConnecting] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tradeFilters, setTradeFilters] = useState<Set<string>>(new Set())
  const [availFilter, setAvailFilter] = useState('')
  const [ratingMin, setRatingMin] = useState(0)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(debounceTimer.current)
  }, [search])

  const loadContractors = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('contractor_profiles')
      .select(`
        id, user_id, primary_trade, business_name, bio, years_experience,
        rating_avg, rating_count, projects_completed, availability_status, available_from,
        user:users!user_id (display_name, handle, avatar_url, location_city, location_state),
        credentials (id, verified_at)
      `)
      .eq('visible_to_owners', true)

    if (debouncedSearch.trim()) {
      q = q.or(`business_name.ilike.%${debouncedSearch}%,bio.ilike.%${debouncedSearch}%,primary_trade.ilike.%${debouncedSearch}%`)
    }
    if (tradeFilters.size > 0) q = q.in('primary_trade', [...tradeFilters])
    if (availFilter) q = q.eq('availability_status', availFilter)
    if (ratingMin > 0) q = q.gte('rating_avg', ratingMin)

    q = q.order('rating_avg', { ascending: false }).limit(60)

    const { data } = await q
    let rows = (data ?? []) as ContractorRow[]

    if (verifiedOnly) {
      rows = rows.filter(r => r.credentials.some(c => c.verified_at))
    }

    if (profile) {
      rows = rows.filter(r => r.user_id !== profile.id)
    }

    setContractors(rows)
    setLoading(false)
  }, [debouncedSearch, tradeFilters, availFilter, ratingMin, verifiedOnly, profile])

  const loadConnections = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('connections')
      .select('requester_id, recipient_id, status')
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    if (!data) return
    const map: ConnectionState = {}
    data.forEach((c: { requester_id: string; recipient_id: string; status: string }) => {
      const otherId = c.requester_id === profile.id ? c.recipient_id : c.requester_id
      if (c.status === 'accepted') map[otherId] = 'accepted'
      else if (c.status === 'pending') map[otherId] = 'pending'
    })
    setConnections(map)
  }, [profile])

  useEffect(() => {
    loadContractors()
  }, [loadContractors])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  async function handleConnect(contractor: ContractorRow) {
    if (!profile) return
    const uid = contractor.user_id
    setConnecting(prev => new Set([...prev, uid]))
    const { error } = await supabase.from('connections').insert({
      requester_id: profile.id,
      recipient_id: uid,
      status: 'pending',
    })
    if (!error) {
      setConnections(prev => ({ ...prev, [uid]: 'pending' }))
    }
    setConnecting(prev => { const n = new Set(prev); n.delete(uid); return n })
  }

  function handleMessage(contractor: ContractorRow) {
    if (!profile) return
    const tid = threadId(profile.id, contractor.user_id)
    navigate(`/messages/${tid}?with=${contractor.user_id}`)
  }

  function toggleTrade(t: string) {
    setTradeFilters(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })
  }

  function clearFilters() {
    setTradeFilters(new Set())
    setAvailFilter('')
    setRatingMin(0)
    setVerifiedOnly(false)
    setSearch('')
  }

  const hasActiveFilters = tradeFilters.size > 0 || availFilter || ratingMin > 0 || verifiedOnly || search

  const Sidebar = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 700, fontSize: 15 }}>Filters</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ fontSize: 12, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
        )}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Trade</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
          {TRADE_OPTIONS.map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={tradeFilters.has(t)} onChange={() => toggleTrade(t)} style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }} />
              {t}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Availability</div>
        {AVAIL_OPTIONS.map(opt => (
          <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="radio" name="avail" checked={availFilter === opt.value} onChange={() => setAvailFilter(opt.value)} style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }} />
            {opt.label}
          </label>
        ))}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Minimum Rating</div>
        {RATING_OPTIONS.map(opt => (
          <label key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="radio" name="rating" checked={ratingMin === opt.value} onChange={() => setRatingMin(opt.value)} style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }} />
            {opt.label}
          </label>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: verifiedOnly ? 600 : 400 }}>
        <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} style={{ accentColor: 'var(--color-brand)', width: 15, height: 15 }} />
        Verified credentials only
      </label>
    </div>
  )

  function AvailabilityBadge({ status }: { status: string }) {
    const cfg = status === 'available'
      ? { text: 'Available', bg: '#ECFDF5', color: '#059669' }
      : status === 'busy'
      ? { text: 'Busy', bg: '#FEF9C3', color: '#92400E' }
      : { text: 'Not Available', bg: '#F3F4F6', color: '#6B7280' }
    return (
      <span style={{ fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 8px' }}>
        {cfg.text}
      </span>
    )
  }

  const COLORS = ['#2563EB', '#059669', '#7C3AED', '#DC2626', '#D97706', '#0891B2', '#E85D04']

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 800, fontSize: 28 }}>Explore Contractors</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 3 }}>
          Discover verified tradespeople and professionals
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 20, width: 240, flexShrink: 0, display: 'none' }} id="explore-sidebar">
          <Sidebar />
        </div>

        <style>{`
          @media (min-width: 900px) {
            #explore-sidebar { display: block !important; }
            #explore-filter-btn { display: none !important; }
          }
        `}</style>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: 10 }} />
              <input
                type="text"
                placeholder="Search name, trade, bio..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </div>

            <button id="explore-filter-btn" onClick={() => setSidebarOpen(o => !o)} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, position: 'relative' }}>
              <SlidersHorizontal size={13} /> Filters
              {hasActiveFilters && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-brand)', position: 'absolute', top: 5, right: 5 }} />}
            </button>

            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {loading ? '…' : contractors.length} contractor{contractors.length !== 1 ? 's' : ''}
            </span>
          </div>

          {sidebarOpen && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <Sidebar />
            </div>
          )}

          {!isContractor && (
            <div style={{ background: 'var(--color-brand-light)', border: '1px solid rgba(232,93,4,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--color-brand)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={14} /> Cold messages to contractors cost {MSG_COLD_COST} credits (you have {profile?.credit_balance ?? 0}).
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)', fontSize: 14 }}>Loading contractors...</div>
          ) : contractors.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>No contractors found</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>
                Try adjusting your filters or{' '}
                <button onClick={clearFilters} style={{ color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>clear all</button>
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {contractors.map(c => {
                const u = c.user
                const verifiedCount = c.credentials.filter(cr => cr.verified_at).length
                const initials = u.display_name.slice(0, 2).toUpperCase()
                const color = COLORS[c.user_id.charCodeAt(0) % COLORS.length]
                const connState = connections[c.user_id] ?? 'none'

                return (
                  <div key={c.id} className="card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div className="avatar-placeholder" style={{ width: 48, height: 48, background: color, fontSize: 15, borderRadius: 10, flexShrink: 0 }}>
                          {initials}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Link to={`/profile/${u.handle}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', textDecoration: 'none' }}>
                            {u.display_name}
                          </Link>
                          {verifiedCount > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#2563EB', fontSize: 11, fontWeight: 700 }}>
                              <CheckCircle size={11} /> {verifiedCount} verified
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{c.primary_trade}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                          {c.rating_count > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#D97706', fontWeight: 600 }}>
                              <Star size={11} fill="#D97706" /> {c.rating_avg.toFixed(1)} ({c.rating_count})
                            </span>
                          )}
                          {(u.location_city || u.location_state) && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--color-text-muted)' }}>
                              <MapPin size={11} /> {[u.location_city, u.location_state].filter(Boolean).join(', ')}
                            </span>
                          )}
                          <AvailabilityBadge status={c.availability_status} />
                        </div>
                      </div>
                    </div>

                    {c.bio && (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {c.bio}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      <span className="badge badge-gray">{c.years_experience}yr exp</span>
                      <span className="badge badge-gray">{c.projects_completed} projects</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/profile/${u.handle}`} className="btn btn-ghost" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Briefcase size={12} /> View Profile
                      </Link>

                      {connState === 'accepted' ? (
                        <span className="btn btn-ghost" style={{ fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
                          <UserCheck size={12} /> Connected
                        </span>
                      ) : connState === 'pending' ? (
                        <span className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'default' }}>Pending</span>
                      ) : (
                        <button
                          onClick={() => handleConnect(c)}
                          disabled={connecting.has(c.user_id)}
                          className="btn btn-ghost"
                          style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <UserPlus size={12} /> Connect
                        </button>
                      )}

                      <button
                        onClick={() => handleMessage(c)}
                        className="btn btn-primary"
                        style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                        title={!isContractor ? `${MSG_COLD_COST} credits for first message` : ''}
                      >
                        <MessageSquare size={12} /> Message
                        {!isContractor && <span style={{ opacity: 0.8, fontSize: 10 }}>({MSG_COLD_COST}cr)</span>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
