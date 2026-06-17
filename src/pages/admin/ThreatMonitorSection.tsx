import { useState, useEffect, useCallback } from 'react'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { Shield, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { SectionProps } from './shared'

interface SecurityEvent {
  id: string
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  ip: string
  user_id: string | null
  path: string
  action_taken: string | null
  resolved: boolean
  details: any
}

interface ThreatSummary {
  total: number
  critical: number
  high: number
  blocked_ips: string[]
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#e05252',
  high: '#e07c52',
  medium: '#e0b852',
  low: '#7cb8e0',
}

export default function ThreatMonitorSection({ authHeaders }: SectionProps) {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [summary, setSummary] = useState<ThreatSummary | null>(null)
  const [quarantine, setQuarantine] = useState<any[]>([])
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showQuarantine, setShowQuarantine] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [threatRes, quarantineRes] = await Promise.all([
        fetch(`/api/admin/monitor/threats?hours=${hours}`, { headers: authHeaders() }),
        fetch('/api/admin/monitor/quarantine', { headers: authHeaders() }),
      ])
      if (!threatRes.ok) throw new Error('Failed to load threats')
      const threatData = await threatRes.json()
      setEvents(threatData.events || [])
      setSummary(threatData.summary)
      if (quarantineRes.ok) {
        const qData = await quarantineRes.json()
        setQuarantine(qData.quarantined || [])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRealtime(['security_events'], load)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <select
          value={hours}
          onChange={e => setHours(Number(e.target.value))}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text)',
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          <option value={1}>Last 1h</option>
          <option value={6}>Last 6h</option>
          <option value={24}>Last 24h</option>
          <option value={72}>Last 72h</option>
        </select>
        <button
          onClick={() => void load()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {err && (
        <div
          style={{
            padding: 12,
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

      {/* Summary cards */}
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { label: 'Total Events', value: summary.total, color: 'var(--color-text)' },
            { label: 'Critical', value: summary.critical, color: '#e05252' },
            { label: 'High', value: summary.high, color: '#e07c52' },
            { label: 'Blocked IPs', value: summary.blocked_ips.length, color: '#e0b852' },
          ].map(card => (
            <div
              key={card.label}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: card.color, marginTop: 4 }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quarantine toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          <Shield size={14} style={{ marginRight: 6, color: 'var(--color-brand)' }} />
          Security Events
        </h3>
        <button
          onClick={() => setShowQuarantine(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '4px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {showQuarantine ? <EyeOff size={12} /> : <Eye size={12} />}
          Quarantine ({quarantine.length})
        </button>
      </div>

      {/* Quarantine log */}
      {showQuarantine && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid #e05252',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e05252', marginBottom: 10 }}>
            🛡 Quarantine Buffer
          </div>
          {quarantine.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              No quarantined requests
            </div>
          ) : (
            quarantine.map(q => (
              <div
                key={q.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                <span style={{ color: '#e05252' }}>[{q.timestamp}]</span> {q.method} {q.path} from{' '}
                {q.ip} — {q.reason}
              </div>
            ))
          )}
        </div>
      )}

      {/* Events table */}
      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
      ) : events.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 32,
          }}
        >
          No security events in the last {hours}h
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['Time', 'Severity', 'Type', 'IP', 'Path', 'Action'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      color: 'var(--color-text-muted)',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td
                    style={{
                      padding: '9px 12px',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: (SEVERITY_COLOR[ev.severity] || '#888') + '22',
                        color: SEVERITY_COLOR[ev.severity] || '#888',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ev.severity}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontFamily: 'monospace',
                      color: 'var(--color-text)',
                    }}
                  >
                    {ev.type}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {ev.ip || '—'}
                  </td>
                  <td
                    style={{
                      padding: '9px 12px',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-muted)',
                      maxWidth: 180,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.path || '—'}
                  </td>
                  <td style={{ padding: '9px 12px', color: 'var(--color-text-muted)' }}>
                    {ev.action_taken || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
