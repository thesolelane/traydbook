import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { SectionProps } from './shared'

interface AuditEntry {
  id: string
  action: string
  target_type: string
  target_id: string
  reason: string
  admin_id: string | null
  ip: string | null
  timestamp: string
  before_state: any
  after_state: any
  details: any
}

const ACTION_COLOR: Record<string, string> = {
  BAN: '#e05252',
  UNBAN: '#52c97a',
  HOLD: '#e07c52',
  MODERATE: 'var(--color-brand)',
  ADJUST_CREDITS: '#7cb8e0',
  SESSION_REVOKE: '#e0b852',
  AI_EXECUTE: '#b87ce0',
}

export default function AuditLogSection({ authHeaders }: SectionProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (actionFilter) params.set('action', actionFilter)
      const res = await fetch(`/api/admin/monitor/audit?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load audit log')
      const data = await res.json()
      setEntries(data.entries || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => {
    void load()
  }, [load])

  const uniqueActions = [...new Set(entries.map(e => e.action))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text)',
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          <option value="">All actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {entries.length} entries
        </span>
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

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 40,
          }}
        >
          No audit entries yet
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
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                borderBottom: i < entries.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <div
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                {expanded === entry.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--color-text-muted)',
                    minWidth: 70,
                  }}
                >
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: (ACTION_COLOR[entry.action] || '#888') + '22',
                    color: ACTION_COLOR[entry.action] || '#888',
                  }}
                >
                  {entry.action}
                </span>
                <span style={{ color: 'var(--color-text)' }}>
                  {entry.target_type} / {entry.target_id.slice(0, 12)}...
                </span>
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    marginLeft: 'auto',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.reason}
                </span>
              </div>
              {expanded === entry.id && (
                <div style={{ padding: '0 14px 12px 38px', fontSize: 11 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Admin ID
                      </div>
                      <div style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>
                        {entry.admin_id || 'system'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>IP</div>
                      <div style={{ fontFamily: 'monospace', color: 'var(--color-text)' }}>
                        {entry.ip || '—'}
                      </div>
                    </div>
                  </div>
                  {(entry.details || entry.before_state || entry.after_state) && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        Details
                      </div>
                      <pre
                        style={{
                          background: 'var(--color-bg)',
                          padding: 10,
                          borderRadius: 6,
                          overflow: 'auto',
                          maxHeight: 160,
                          fontSize: 10,
                          color: 'var(--color-text-muted)',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(
                          entry.details || { before: entry.before_state, after: entry.after_state },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
