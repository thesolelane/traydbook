import { useState, useEffect } from 'react'
import { Building2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  tableHeaderStyle,
  tableCellStyle,
  LoadingRow,
  formatDate,
} from './shared'

interface Brokerage {
  id: string
  display_name: string | null
  handle: string | null
  email: string | null
  credit_balance: number
  total_issued: number
  transfer_count: number
  created_at: string
}

interface Transfer {
  id: string
  amount: number
  note: string | null
  created_at: string
  to_user: { id: string; display_name: string | null; handle: string | null; email: string | null } | null
}

export default function BrokeragesSection({ authHeaders }: SectionProps) {
  const [brokerages, setBrokerages] = useState<Brokerage[]>([])
  const [loading, setLoading]       = useState(true)
  const [err, setErr]               = useState('')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [transfers, setTransfers]   = useState<Record<string, Transfer[]>>({})
  const [txLoading, setTxLoading]   = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/brokerages', { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load')
      const data = await res.json()
      setBrokerages(data.brokerages ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load brokerages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (transfers[id]) return
    setTxLoading(t => ({ ...t, [id]: true }))
    try {
      const res = await fetch(`/api/admin/brokerages/${id}/transfers`, { headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const data = await res.json()
      setTransfers(t => ({ ...t, [id]: data.transfers ?? [] }))
    } catch {
      setTransfers(t => ({ ...t, [id]: [] }))
    } finally {
      setTxLoading(t => ({ ...t, [id]: false }))
    }
  }

  const badge = (n: number) => (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(232,93,4,0.15)', color: 'var(--color-brand)' }}>
      {n.toLocaleString()}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {err && (
        <div style={{ padding: '10px 14px', background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>
          {err}
        </div>
      )}

      <SectionCard
        title="Brokerage Accounts"
        subtitle="Credit pool balance and issuance history per brokerage."
        action={
          <button
            onClick={load}
            style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: '#999', padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        }
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['', 'Brokerage', 'Email', 'Pool balance', 'Credits issued', 'Transfers', 'Joined'].map(h => (
                <th key={h} style={tableHeaderStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRow cols={7} />
            ) : brokerages.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#666', fontSize: 13 }}>
                  <Building2 size={28} style={{ marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                  No brokerage accounts yet
                </td>
              </tr>
            ) : (
              brokerages.map(b => (
                <>
                  <tr
                    key={b.id}
                    style={{ cursor: 'pointer', background: expanded === b.id ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                    onClick={() => toggleExpand(b.id)}
                  >
                    <td style={{ ...tableCellStyle, width: 32, color: '#666' }}>
                      {expanded === b.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ fontWeight: 600 }}>{b.display_name ?? '—'}</div>
                      {b.handle && <div style={{ fontSize: 11, color: '#666' }}>@{b.handle}</div>}
                    </td>
                    <td style={{ ...tableCellStyle, color: '#888', fontSize: 12 }}>{b.email ?? '—'}</td>
                    <td style={tableCellStyle}>{badge(b.credit_balance)}</td>
                    <td style={tableCellStyle}>{b.total_issued.toLocaleString()}</td>
                    <td style={{ ...tableCellStyle, color: '#888' }}>{b.transfer_count}</td>
                    <td style={{ ...tableCellStyle, color: '#666', fontSize: 12 }}>{formatDate(b.created_at)}</td>
                  </tr>

                  {expanded === b.id && (
                    <tr key={`${b.id}-detail`}>
                      <td colSpan={7} style={{ padding: 0, background: '#0d0d0d', borderBottom: '1px solid #222' }}>
                        {txLoading[b.id] ? (
                          <div style={{ padding: '16px 24px', color: '#666', fontSize: 13 }}>Loading transfers…</div>
                        ) : !transfers[b.id]?.length ? (
                          <div style={{ padding: '16px 24px', color: '#555', fontSize: 13 }}>No credits issued yet.</div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {['Recipient', 'Email', 'Credits', 'Note', 'Date'].map(h => (
                                  <th key={h} style={{ ...tableHeaderStyle, background: '#0d0d0d', paddingLeft: h === 'Recipient' ? 32 : 12 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {transfers[b.id].map(t => (
                                <tr key={t.id}>
                                  <td style={{ ...tableCellStyle, paddingLeft: 32 }}>
                                    <div style={{ fontWeight: 600 }}>{t.to_user?.display_name ?? '—'}</div>
                                    {t.to_user?.handle && <div style={{ fontSize: 11, color: '#666' }}>@{t.to_user.handle}</div>}
                                  </td>
                                  <td style={{ ...tableCellStyle, fontSize: 12, color: '#888' }}>{t.to_user?.email ?? '—'}</td>
                                  <td style={tableCellStyle}>{t.amount.toLocaleString()}</td>
                                  <td style={{ ...tableCellStyle, color: '#888', fontSize: 12 }}>{t.note ?? '—'}</td>
                                  <td style={{ ...tableCellStyle, color: '#666', fontSize: 12 }}>{formatDate(t.created_at)}</td>
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
