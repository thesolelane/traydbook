import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { SectionProps, SectionCard } from './shared'

interface DomainResult {
  domain: string
  label: string
  note: string
  status: 'operational' | 'degraded' | 'down' | 'checking'
  latency: number | null
  httpStatus: number | null
  error?: string
}

const STATUS_COLOR: Record<string, string> = {
  operational: '#059669',
  degraded:    '#D97706',
  down:        '#DC2626',
  checking:    '#6B7280',
}

const ENV_LABELS = [
  { label: 'Supabase Project', value: 'traydbook (production)', color: '#059669' },
  { label: 'Auth Provider',    value: 'Supabase Auth (email + OAuth)', color: '#2563EB' },
  { label: 'Payments',         value: 'Stripe (live mode)', color: '#7C3AED' },
  { label: 'SMS Alerts',       value: 'Telnyx (production)', color: '#D97706' },
  { label: 'Hosting',          value: 'Replit Deployments', color: '#0891B2' },
]

const PLACEHOLDER: DomainResult[] = [
  { domain: 'traydbook.com',        label: 'Marketing Site', note: 'Public-facing landing page.',              status: 'checking', latency: null, httpStatus: null },
  { domain: 'app.traydbook.com',    label: 'Web App',        note: 'Main application. React + Supabase.',      status: 'checking', latency: null, httpStatus: null },
  { domain: 'admin.traydbook.com',  label: 'Admin Panel',    note: 'Admin control center. Deployed on Coolify.', status: 'checking', latency: null, httpStatus: null },
  { domain: 'bob.traydbook.com',    label: 'Bob (AI Agent)', note: 'Autonomous AI agent. Deployed on Coolify.', status: 'checking', latency: null, httpStatus: null },
  { domain: 'secure.traydbook.com', label: 'Auth / API',     note: 'Supabase auth and API endpoint.',           status: 'checking', latency: null, httpStatus: null },
]

export default function DomainsSection({ authHeaders }: SectionProps) {
  const [domains, setDomains] = useState<DomainResult[]>(PLACEHOLDER)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [devEnv, setDevEnv] = useState(false)

  const check = useCallback(async () => {
    setLoading(true)
    setErr('')
    setDomains(PLACEHOLDER)
    try {
      const res = await fetch('/api/admin/monitor/domains', { headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setDomains(data.domains || [])
      setCheckedAt(data.checkedAt || null)
      setDevEnv(!!data.devEnv)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to ping domains')
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { void check() }, [check])

  const summary = {
    operational: domains.filter(d => d.status === 'operational').length,
    degraded:    domains.filter(d => d.status === 'degraded').length,
    down:        domains.filter(d => d.status === 'down').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => void check()}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-muted)', padding: '6px 12px',
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Checking…' : 'Re-check'}
        </button>

        {!loading && (
          <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
            {summary.operational > 0 && (
              <span style={{ color: '#059669', fontWeight: 600 }}>
                {summary.operational} operational
              </span>
            )}
            {summary.degraded > 0 && (
              <span style={{ color: '#D97706', fontWeight: 600 }}>
                {summary.degraded} degraded
              </span>
            )}
            {summary.down > 0 && (
              <span style={{ color: '#DC2626', fontWeight: 600 }}>
                {summary.down} down
              </span>
            )}
          </div>
        )}

        {checkedAt && !loading && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
            Checked {new Date(checkedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {devEnv && !loading && (
        <div style={{ padding: '10px 14px', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, fontSize: 12, color: '#2563EB' }}>
          Running in dev — Replit's network sandbox may block outbound pings to some domains. Results will be accurate on the deployed admin server.
        </div>
      )}

      {err && (
        <div style={{ padding: 12, background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>
          {err}
        </div>
      )}

      {domains.map(d => {
        const color = STATUS_COLOR[d.status] ?? '#6B7280'
        return (
          <div
            key={d.domain}
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20,
              display: 'flex', alignItems: 'flex-start', gap: 16,
            }}
          >
            <div
              style={{
                width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                background: color,
                boxShadow: d.status === 'checking' ? 'none' : `0 0 0 3px ${color}26`,
                animation: d.status === 'checking' ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>
                  {d.domain}
                </span>
                <span style={{ fontSize: 11, background: 'var(--color-border)', padding: '2px 8px', borderRadius: 20, color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  {d.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}18`, color }}>
                  {d.status.toUpperCase()}
                </span>
                {d.latency !== null && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {d.latency}ms
                  </span>
                )}
                {d.httpStatus !== null && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                    HTTP {d.httpStatus}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                {d.note}
                {d.error && (
                  <span style={{ color: '#DC2626', marginLeft: 8 }}>— {d.error}</span>
                )}
              </p>
            </div>
            {d.domain !== 'admin.traydbook.com' && (
              <a
                href={`https://${d.domain}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )
      })}

      <SectionCard title="Environment Labels">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ENV_LABELS.map(row => (
            <div
              key={row.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', background: 'var(--color-bg)',
                borderRadius: 8, border: '1px solid var(--color-border)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', minWidth: 140 }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
