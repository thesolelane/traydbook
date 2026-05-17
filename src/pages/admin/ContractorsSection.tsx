import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  RefreshCw,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  AdminInput,
  LoadingRow,
  tableHeaderStyle,
  tableCellStyle,
  StatCard,
} from './shared'

interface ContractorRow {
  user_id: string
  display_name: string
  handle: string
  avatar_url: string | null
  created_at: string
  deleted_at: string | null
  primary_trade: string
  badge_tier: string | null
  trust_score: number
  lead_bank_balance: number
  rating_avg: number
  rating_count: number
  projects_completed: number
  years_experience: number
}

const BADGE_COLORS: Record<string, string> = {
  pro_verified: '#059669',
  licensed: '#2563EB',
  vouched: '#7C3AED',
}

function TrustBar({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'var(--color-border)',
          borderRadius: 2,
          overflow: 'hidden',
          minWidth: 60,
        }}
      >
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  )
}

export default function ContractorsSection({ authHeaders }: SectionProps) {
  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [ledger, setLedger] = useState<Record<string, unknown>[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)

  const [adjustId, setAdjustId] = useState('')
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState('')
  const [adjustErr, setAdjustErr] = useState('')

  const [recalcId, setRecalcId] = useState<string | null>(null)
  const [recalcMsg, setRecalcMsg] = useState('')
  const [recalcErr, setRecalcErr] = useState('')

  const [msg, _setMsg] = useState('')
  const [err, setErr] = useState('')

  const loadContractors = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/contractors?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setContractors(data.contractors ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load contractors')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    void loadContractors()
  }, [loadContractors])

  async function expandLedger(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null)
      return
    }
    setExpandedId(userId)
    setLedgerLoading(true)
    try {
      const res = await fetch(`/api/admin/contractors/${userId}/lead-bank/ledger`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLedger(data.ledger ?? [])
    } catch {
      setLedger([])
    }
    setLedgerLoading(false)
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustId || !adjustDelta || !adjustReason) {
      setAdjustErr('All fields required')
      return
    }
    setAdjusting(true)
    setAdjustMsg('')
    setAdjustErr('')
    try {
      const res = await fetch(`/api/admin/contractors/${adjustId}/lead-bank/adjust`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta: parseInt(adjustDelta, 10), reason: adjustReason }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setAdjustMsg(`Done — new balance: ${data.new_balance} leads`)
      setAdjustDelta('')
      setAdjustReason('')
      void loadContractors()
    } catch (e) {
      setAdjustErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAdjusting(false)
    }
  }

  async function handleRecalc(userId: string) {
    setRecalcId(userId)
    setRecalcMsg('')
    setRecalcErr('')
    try {
      const res = await fetch(`/api/admin/contractors/${userId}/trust-score/recalc`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setRecalcMsg(`Score updated to ${data.new_score}`)
      void loadContractors()
    } catch (e) {
      setRecalcErr(e instanceof Error ? e.message : 'Failed to recalculate')
    } finally {
      setRecalcId(null)
    }
  }

  const totalTrustAvg = contractors.length
    ? Math.round(contractors.reduce((s, c) => s + c.trust_score, 0) / contractors.length)
    : 0
  const totalLeads = contractors.reduce((s, c) => s + c.lead_bank_balance, 0)
  const badged = contractors.filter(c => c.badge_tier).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <StatCard
          label="Avg Trust Score"
          value={totalTrustAvg}
          icon={<TrendingUp size={18} />}
          color="#10B981"
        />
        <StatCard
          label="Total Lead Bank"
          value={totalLeads}
          sub="leads across all contractors"
          icon={<Layers size={18} />}
          color="#6366F1"
        />
        <StatCard
          label="Badged Contractors"
          value={badged}
          sub={`of ${contractors.length} loaded`}
          icon={<TrendingUp size={18} />}
          color="#F59E0B"
        />
      </div>

      {/* Lead Bank Adjust */}
      <SectionCard title="Adjust Lead Bank Balance">
        <form
          onSubmit={handleAdjust}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              User ID
            </label>
            <AdminInput
              value={adjustId}
              onChange={setAdjustId}
              placeholder="paste user_id"
              style={{ width: 280 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Delta (+ or −)
            </label>
            <AdminInput
              value={adjustDelta}
              onChange={setAdjustDelta}
              placeholder="e.g. 10 or -3"
              style={{ width: 100 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Reason
            </label>
            <AdminInput
              value={adjustReason}
              onChange={setAdjustReason}
              placeholder="manual_grant / admin_adjustment / …"
              style={{ width: 240 }}
            />
          </div>
          <button
            type="submit"
            disabled={adjusting}
            className="btn btn-primary"
            style={{ fontSize: 13, padding: '8px 18px' }}
          >
            {adjusting ? 'Saving…' : 'Apply'}
          </button>
        </form>
        {adjustMsg && <p style={{ color: '#10B981', fontSize: 13, marginTop: 8 }}>{adjustMsg}</p>}
        {adjustErr && <p style={{ color: '#EF4444', fontSize: 13, marginTop: 8 }}>{adjustErr}</p>}
      </SectionCard>

      {/* Contractors table */}
      <SectionCard
        title="All Contractors"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Search size={14} color="var(--color-text-muted)" />
            <AdminInput
              value={search}
              onChange={v => {
                setSearch(v)
                setPage(0)
              }}
              placeholder="name, handle, trade…"
              style={{ width: 200 }}
            />
            <button
              onClick={loadContractors}
              className="btn btn-secondary"
              style={{
                fontSize: 12,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        }
      >
        {err && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{err}</p>}
        {(recalcMsg || recalcErr) && (
          <p style={{ color: recalcErr ? '#EF4444' : '#10B981', fontSize: 13, marginBottom: 12 }}>
            {recalcMsg || recalcErr}
          </p>
        )}
        {msg && <p style={{ color: '#10B981', fontSize: 13, marginBottom: 12 }}>{msg}</p>}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Contractor',
                  'Trade',
                  'Badge',
                  'Trust Score',
                  'Lead Bank',
                  'Reviews',
                  'Actions',
                ].map(h => (
                  <th key={h} style={tableHeaderStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <LoadingRow key={i} cols={7} />)
              ) : contractors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      ...tableCellStyle,
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    No contractors found
                  </td>
                </tr>
              ) : (
                contractors.map(c => (
                  <>
                    <tr key={c.user_id} style={{ opacity: c.deleted_at ? 0.45 : 1 }}>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'var(--color-border)',
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.display_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                              @{c.handle}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={tableCellStyle}>{c.primary_trade}</td>
                      <td style={tableCellStyle}>
                        {c.badge_tier ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: BADGE_COLORS[c.badge_tier] ?? '#888',
                              background: `${BADGE_COLORS[c.badge_tier] ?? '#888'}18`,
                              padding: '2px 7px',
                              borderRadius: 10,
                            }}
                          >
                            {c.badge_tier}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tableCellStyle, minWidth: 120 }}>
                        <TrustBar score={c.trust_score} />
                      </td>
                      <td style={tableCellStyle}>
                        <button
                          onClick={() => expandLedger(c.user_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 13,
                            color: 'var(--color-text)',
                            fontWeight: 600,
                          }}
                        >
                          <Layers size={12} color="#6366F1" />
                          {c.lead_bank_balance}
                          {expandedId === c.user_id ? (
                            <ChevronUp size={11} />
                          ) : (
                            <ChevronDown size={11} />
                          )}
                        </button>
                      </td>
                      <td style={tableCellStyle}>
                        {c.rating_count > 0 ? (
                          `${c.rating_avg.toFixed(1)} (${c.rating_count})`
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleRecalc(c.user_id)}
                            disabled={recalcId === c.user_id}
                            className="btn btn-secondary"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                            title="Recalculate trust score"
                          >
                            <RefreshCw size={10} />
                            {recalcId === c.user_id ? '…' : 'Recalc'}
                          </button>
                          <button
                            onClick={() => {
                              setAdjustId(c.user_id)
                              setAdjustDelta('')
                              setAdjustReason('')
                            }}
                            className="btn btn-secondary"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                            title="Adjust lead bank"
                          >
                            <Layers size={10} /> Adjust
                          </button>
                          <a
                            href={`/u/${c.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <ExternalLink size={10} /> Profile
                          </a>
                        </div>
                      </td>
                    </tr>

                    {/* Inline ledger expansion */}
                    {expandedId === c.user_id && (
                      <tr key={`${c.user_id}-ledger`}>
                        <td
                          colSpan={7}
                          style={{
                            background: 'var(--color-bg)',
                            padding: '12px 20px',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: 'var(--color-text-muted)',
                              letterSpacing: '0.5px',
                              marginBottom: 8,
                            }}
                          >
                            Lead Bank Ledger
                          </div>
                          {ledgerLoading ? (
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              Loading…
                            </p>
                          ) : ledger.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              No transactions yet
                            </p>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Date', 'Delta', 'Balance After', 'Reason'].map(h => (
                                    <th key={h} style={{ ...tableHeaderStyle, fontSize: 10 }}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ledger.map((entry: Record<string, unknown>) => (
                                  <tr key={entry.id as string}>
                                    <td style={{ ...tableCellStyle, fontSize: 12 }}>
                                      {new Date(entry.created_at as string).toLocaleDateString(
                                        'en-US',
                                        { month: 'short', day: 'numeric', year: 'numeric' }
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        ...tableCellStyle,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: (entry.delta as number) >= 0 ? '#10B981' : '#EF4444',
                                      }}
                                    >
                                      {(entry.delta as number) >= 0 ? '+' : ''}
                                      {entry.delta as number}
                                    </td>
                                    <td style={{ ...tableCellStyle, fontSize: 12 }}>
                                      {entry.balance_after as number}
                                    </td>
                                    <td
                                      style={{
                                        ...tableCellStyle,
                                        fontSize: 12,
                                        color: 'var(--color-text-muted)',
                                      }}
                                    >
                                      {(entry.reason as string).replace(/_/g, ' ')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
            Page {page + 1}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={contractors.length < 50}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Next →
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
