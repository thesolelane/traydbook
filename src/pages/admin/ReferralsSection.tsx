import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, ChevronRight, RefreshCw, GitBranch } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  tableHeaderStyle,
  tableCellStyle,
  LoadingRow,
  formatDate,
  AdminInput,
} from './shared'

interface ReferralUser {
  id: string
  display_name: string | null
  handle: string | null
  email: string | null
  account_type: string | null
  referral_code: string | null
  referral_credits_held: number
  credit_balance: number
  created_at: string
  referral_count: number
  referrals_held: number
  referrals_released: number
}

interface ReferralSignup {
  id: string
  credits_earned: number
  held: boolean
  released_at: string | null
  created_at: string
  referred_user: {
    id: string
    display_name: string | null
    handle: string | null
    email: string | null
    account_type: string | null
  } | null
}

export default function ReferralsSection({ authHeaders }: SectionProps) {
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<ReferralUser[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [signups, setSignups] = useState<Record<string, ReferralSignup[]>>({})
  const [sigLoading, setSigLoading] = useState<Record<string, boolean>>({})
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load(search = q) {
    setLoading(true)
    setErr('')
    try {
      const url = `/api/admin/referrals${search ? `?q=${encodeURIComponent(search)}` : ''}`
      const res = await fetch(url, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function handleSearch(val: string) {
    setQ(val)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => load(val), 400)
  }

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    if (signups[id]) return
    setSigLoading(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setSignups(s => ({ ...s, [id]: data.signups ?? [] }))
    } catch {
      setSignups(s => ({ ...s, [id]: [] }))
    } finally {
      setSigLoading(s => ({ ...s, [id]: false }))
    }
  }

  const chip = (label: string, color: string, bg: string) => (
    <span
      style={{
        padding: '2px 7px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
      }}
    >
      {label}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {err && (
        <div
          style={{
            padding: '10px 14px',
            background: '#2a1515',
            border: '1px solid #e05252',
            borderRadius: 8,
            color: '#e05252',
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <SectionCard
        title="Referral Stats"
        subtitle="Held credits, release history, and per-user referral counts."
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                style={{ position: 'absolute', left: 10, color: '#666', pointerEvents: 'none' }}
              />
              <AdminInput
                value={q}
                onChange={handleSearch}
                placeholder="Search name, email, code…"
                style={{ paddingLeft: 30, width: 220 }}
              />
            </div>
            <button
              onClick={() => load(q)}
              style={{
                background: 'none',
                border: '1px solid #333',
                borderRadius: 6,
                color: '#999',
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        }
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                '',
                'User',
                'Type',
                'Referral code',
                'Held credits',
                'Total referrals',
                'Held / Released',
                'Balance',
              ].map(h => (
                <th key={h} style={tableHeaderStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={8} />
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 32, textAlign: 'center', color: '#666', fontSize: 13 }}
                >
                  <GitBranch
                    size={28}
                    style={{
                      marginBottom: 8,
                      opacity: 0.3,
                      display: 'block',
                      margin: '0 auto 8px',
                    }}
                  />
                  {q ? 'No matching users' : 'No referral activity yet'}
                </td>
              </tr>
            ) : (
              users.map(u => (
                <>
                  <tr
                    key={u.id}
                    style={{
                      cursor: 'pointer',
                      background: expanded === u.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                    }}
                    onClick={() => toggleExpand(u.id)}
                  >
                    <td style={{ ...tableCellStyle, width: 32, color: '#666' }}>
                      {expanded === u.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600 }}>{u.display_name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {u.email ?? (u.handle ? `@${u.handle}` : '—')}
                      </div>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>
                        {u.account_type ?? '—'}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tableCellStyle,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: u.referral_code ? '#a78bfa' : '#555',
                      }}
                    >
                      {u.referral_code ?? 'none'}
                    </td>
                    <td style={tableCellStyle}>
                      {u.referral_credits_held > 0 ? (
                        chip(`${u.referral_credits_held} held`, '#facc15', 'rgba(250,204,21,0.12)')
                      ) : (
                        <span style={{ color: '#444' }}>0</span>
                      )}
                    </td>
                    <td style={tableCellStyle}>{u.referral_count}</td>
                    <td style={tableCellStyle}>
                      <span style={{ color: '#f97316', marginRight: 6 }}>
                        {u.referrals_held} held
                      </span>
                      <span style={{ color: '#4ade80' }}>{u.referrals_released} released</span>
                    </td>
                    <td style={{ ...tableCellStyle, color: '#888' }}>
                      {u.credit_balance.toLocaleString()}
                    </td>
                  </tr>

                  {expanded === u.id && (
                    <tr key={`${u.id}-sigs`}>
                      <td
                        colSpan={8}
                        style={{
                          padding: 0,
                          background: '#0d0d0d',
                          borderBottom: '1px solid #222',
                        }}
                      >
                        {sigLoading[u.id] ? (
                          <div style={{ padding: '16px 24px', color: '#666', fontSize: 13 }}>
                            Loading referrals…
                          </div>
                        ) : !signups[u.id]?.length ? (
                          <div style={{ padding: '16px 24px', color: '#555', fontSize: 13 }}>
                            No referral signups recorded.
                          </div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {[
                                  'Referred user',
                                  'Type',
                                  'Credits earned',
                                  'Status',
                                  'Released at',
                                  'Signup date',
                                ].map(h => (
                                  <th
                                    key={h}
                                    style={{
                                      ...tableHeaderStyle,
                                      background: '#0d0d0d',
                                      paddingLeft: h === 'Referred user' ? 32 : 12,
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {signups[u.id].map(s => (
                                <tr key={s.id}>
                                  <td style={{ ...tableCellStyle, paddingLeft: 32 }}>
                                    <div style={{ fontWeight: 600 }}>
                                      {s.referred_user?.display_name ?? '—'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#666' }}>
                                      {s.referred_user?.email ??
                                        (s.referred_user?.handle
                                          ? `@${s.referred_user.handle}`
                                          : '')}
                                    </div>
                                  </td>
                                  <td
                                    style={{
                                      ...tableCellStyle,
                                      fontSize: 11,
                                      color: '#888',
                                      textTransform: 'capitalize',
                                    }}
                                  >
                                    {s.referred_user?.account_type ?? '—'}
                                  </td>
                                  <td style={tableCellStyle}>{s.credits_earned}</td>
                                  <td style={tableCellStyle}>
                                    {s.held
                                      ? chip('Held', '#facc15', 'rgba(250,204,21,0.12)')
                                      : chip('Released', '#4ade80', 'rgba(74,222,128,0.12)')}
                                  </td>
                                  <td style={{ ...tableCellStyle, color: '#666', fontSize: 12 }}>
                                    {s.released_at ? formatDate(s.released_at) : '—'}
                                  </td>
                                  <td style={{ ...tableCellStyle, color: '#666', fontSize: 12 }}>
                                    {formatDate(s.created_at)}
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
      </SectionCard>
    </div>
  )
}
