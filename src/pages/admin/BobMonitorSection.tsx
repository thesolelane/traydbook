import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Pause,
  Play,
  Zap,
  AlertTriangle,
  Clock,
  RotateCcw,
  Lightbulb,
  X,
} from 'lucide-react'
import {
  SectionProps,
  SectionCard,
  StatCard,
  tableHeaderStyle,
  tableCellStyle,
  AdminInput,
} from './shared'
import { supabase } from '../../lib/supabase'

interface AgentLog {
  id: string
  agent_name: string
  action: string
  status: 'success' | 'failure' | 'skipped' | 'ok' | 'warn' | 'error'
  target_type: string | null
  target_id: string | null
  contractor_id: string | null
  message: string | null
  metadata: Record<string, unknown>
  ai_provider: string | null
  duration_ms: number | null
  created_at: string
}

interface BobControl {
  paused: boolean
  ai_provider_override: string | null
  lead_refresh_force: boolean
  max_leads_per_cycle: number
}

const DISMISSED_KEY = 'bob_suggestions_dismissed'

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
  } catch { /* silent — localStorage unavailable */ }
}

// Full action vocabulary from Bob's contract + suggestions
const ACTION_GROUPS: Record<string, string[]> = {
  Leads: ['lead.found', 'lead.scored', 'lead.delivered', 'lead.skipped'],
  Outreach: ['outreach.drafted', 'outreach.sent', 'outreach.opened', 'outreach.replied'],
  Content: ['content.generated', 'content.posted', 'content.failed'],
  Quote: ['quote.drafted', 'quote.sent'],
  Schedule: ['schedule.created', 'schedule.confirmed'],
  AI: ['ai.fallback', 'ai.error', 'agent.provider_switched'],
  Agent: ['agent.paused', 'agent.resumed'],
  System: ['error.occurred', 'webhook.received', 'webhook.rejected'],
  Suggestions: ['panel.suggestion'],
}

const STATUS_COLOR: Record<string, string> = {
  success: '#10B981',
  ok: '#10B981',
  skipped: '#F59E0B',
  warn: '#F59E0B',
  failure: '#EF4444',
  error: '#EF4444',
}

const ACTION_COLOR: Record<string, string> = {
  'lead.delivered': '#6366F1',
  'lead.found': '#8B5CF6',
  'lead.scored': '#A78BFA',
  'lead.skipped': '#94A3B8',
  'outreach.sent': '#10B981',
  'outreach.drafted': '#34D399',
  'outreach.opened': '#6EE7B7',
  'outreach.replied': '#059669',
  'content.generated': '#F59E0B',
  'content.posted': '#D97706',
  'content.failed': '#EF4444',
  'quote.sent': '#3B82F6',
  'quote.drafted': '#60A5FA',
  'ai.fallback': '#F97316',
  'ai.error': '#EF4444',
  'error.occurred': '#EF4444',
  'agent.paused': '#94A3B8',
  'agent.resumed': '#10B981',
  'webhook.received': '#6366F1',
  'webhook.rejected': '#EF4444',
  'panel.suggestion': '#F59E0B',
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function BobMonitorSection({ authHeaders }: SectionProps) {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [suggestions, setSuggestions] = useState<AgentLog[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const [controls, setControls] = useState<BobControl | null>(null)
  const [loading, setLoading] = useState(true)
  const [controlLoading, setControlLoading] = useState(false)
  const [err, setErr] = useState('')
  const [controlMsg, setControlMsg] = useState('')
  const [providerOverride, setProviderOverride] = useState('')
  const [maxLeads, setMaxLeads] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (actionFilter) params.set('action', actionFilter)
      if (statusFilter) params.set('status', statusFilter)

      const [logsRes, controlsRes, suggestionsRes] = await Promise.all([
        fetch(`/api/admin/bob/logs?${params}`, { headers: authHeaders() }),
        fetch('/api/admin/bob/control', { headers: authHeaders() }),
        fetch('/api/admin/bob/logs?action=panel.suggestion&limit=20', { headers: authHeaders() }),
      ])
      if (logsRes.ok) setLogs((await logsRes.json()).logs ?? [])
      if (controlsRes.ok) {
        const c = await controlsRes.json()
        setControls(c)
        setProviderOverride(c.ai_provider_override ?? '')
        setMaxLeads(String(c.max_leads_per_cycle))
      }
      if (suggestionsRes.ok) setSuggestions((await suggestionsRes.json()).logs ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, statusFilter])

  useEffect(() => {
    void load()

    const channel = supabase
      .channel('admin-agent-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_logs' },
        payload => {
          const entry = payload.new as AgentLog
          if (entry.action === 'panel.suggestion') {
            setSuggestions(prev => [entry, ...prev].slice(0, 20))
          }
          setLogs(prev => [entry, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => void load(), 15000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

  function dismiss(id: string) {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(next)
  }

  function dismissAll() {
    const next = new Set(dismissed)
    suggestions.forEach(s => next.add(s.id))
    setDismissed(next)
    saveDismissed(next)
  }

  async function setControl(key: string, value: string) {
    setControlLoading(true)
    setControlMsg('')
    const res = await fetch('/api/admin/bob/control', {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (res.ok) {
      setControlMsg(`${key} updated`)
      void load()
    } else {
      setControlMsg('Failed to update')
    }
    setControlLoading(false)
    setTimeout(() => setControlMsg(''), 3000)
  }

  const activeSuggestions = suggestions.filter(s => !dismissed.has(s.id))
  const failureCount = logs.filter(l => l.status === 'failure' || l.status === 'error').length
  const filteredLogs = logs.filter(l => {
    if (actionFilter && l.action !== actionFilter) return false
    if (statusFilter && l.status !== statusFilter) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard
          label="Bob Status"
          value={controls ? (controls.paused ? 'PAUSED' : 'ACTIVE') : '—'}
          icon={controls?.paused ? <Pause size={18} /> : <Zap size={18} />}
          color={controls?.paused ? '#EF4444' : '#10B981'}
        />
        <StatCard
          label="Recent Actions"
          value={logs.length}
          sub="last 50"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Failures"
          value={failureCount}
          sub="in recent logs"
          icon={<AlertTriangle size={18} />}
          color={failureCount > 0 ? '#EF4444' : '#10B981'}
        />
        <StatCard
          label="Suggestions"
          value={activeSuggestions.length}
          sub={activeSuggestions.length > 0 ? 'from Bob' : 'nothing new'}
          icon={<Lightbulb size={18} />}
          color={activeSuggestions.length > 0 ? '#F59E0B' : undefined}
        />
      </div>

      {/* Bob Suggestions inbox — only shown when there are active ones */}
      {activeSuggestions.length > 0 && (
        <SectionCard
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={15} color="#F59E0B" />
              Bob Suggestions
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: 'rgba(245,158,11,0.15)',
                  color: '#F59E0B',
                }}
              >
                {activeSuggestions.length}
              </span>
            </span>
          }
          action={
            <button
              onClick={dismissAll}
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px', color: 'var(--color-text-muted)' }}
            >
              Dismiss all
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeSuggestions.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'rgba(245,158,11,0.06)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  alignItems: 'flex-start',
                }}
              >
                <Lightbulb size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-text)' }}
                  >
                    {s.message || '(no message)'}
                  </p>
                  {s.metadata && Object.keys(s.metadata).length > 0 && (
                    <pre
                      style={{
                        margin: '6px 0 0',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg)',
                        padding: '6px 8px',
                        borderRadius: 5,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(s.metadata, null, 2)}
                    </pre>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      marginTop: 4,
                      display: 'block',
                    }}
                  >
                    {s.agent_name} · {timeAgo(s.created_at)}
                  </span>
                </div>
                <button
                  onClick={() => dismiss(s.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 2,
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                  }}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Controls */}
      <SectionCard title="Bob Controls">
        {controlMsg && (
          <p style={{ fontSize: 13, color: '#10B981', marginBottom: 12 }}>{controlMsg}</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <button
            onClick={() => setControl('paused', controls?.paused ? 'false' : 'true')}
            disabled={controlLoading}
            className="btn btn-primary"
            style={{
              fontSize: 13,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: controls?.paused ? '#10B981' : '#EF4444',
            }}
          >
            {controls?.paused ? (
              <>
                <Play size={14} /> Resume Bob
              </>
            ) : (
              <>
                <Pause size={14} /> Pause Bob
              </>
            )}
          </button>

          <button
            onClick={() => setControl('lead_refresh_force', 'true')}
            disabled={controlLoading}
            className="btn btn-secondary"
            style={{
              fontSize: 13,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RotateCcw size={14} /> Force Lead Search
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              AI Provider Override
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <AdminInput
                value={providerOverride}
                onChange={setProviderOverride}
                placeholder="openai / ollama / blank = default"
                style={{ width: 220 }}
              />
              <button
                onClick={() => setControl('ai_provider_override', providerOverride)}
                disabled={controlLoading}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '8px 12px' }}
              >
                Set
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Max Leads / Cycle
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <AdminInput
                value={maxLeads}
                onChange={setMaxLeads}
                placeholder="10"
                style={{ width: 70 }}
              />
              <button
                onClick={() => setControl('max_leads_per_cycle', maxLeads)}
                disabled={controlLoading}
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '8px 12px' }}
              >
                Set
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Live activity log */}
      <SectionCard
        title="Live Activity Feed"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
                <optgroup key={group} label={group}>
                  {actions.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 5,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="skipped">Skipped</option>
            </select>

            <button
              onClick={() => setAutoRefresh(a => !a)}
              className="btn btn-ghost"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                color: autoRefresh ? '#10B981' : 'var(--color-text-muted)',
              }}
            >
              {autoRefresh ? '● Live' : '○ Paused'}
            </button>
            <button
              onClick={load}
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Action', 'Status', 'Message', 'Target', 'AI', 'ms'].map(h => (
                  <th key={h} style={tableHeaderStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={{ padding: '10px 12px' }}>
                        <div
                          style={{
                            height: 12,
                            background: 'var(--color-border)',
                            borderRadius: 4,
                            opacity: 0.5,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      ...tableCellStyle,
                      textAlign: 'center',
                      color: 'var(--color-text-muted)',
                      padding: 32,
                    }}
                  >
                    {logs.length === 0
                      ? "No activity yet — Bob hasn't logged anything"
                      : 'No logs match the current filters'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr
                    key={log.id}
                    style={{
                      background:
                        log.action === 'panel.suggestion' ? 'rgba(245,158,11,0.04)' : undefined,
                    }}
                  >
                    <td
                      style={{
                        ...tableCellStyle,
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {timeAgo(log.created_at)}
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: ACTION_COLOR[log.action] ?? 'var(--color-text)',
                          background: `${ACTION_COLOR[log.action] ?? '#888'}18`,
                          padding: '2px 7px',
                          borderRadius: 10,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: STATUS_COLOR[log.status] ?? '#888',
                        }}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, fontSize: 12, maxWidth: 260 }}>
                      {log.message || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td
                      style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                      {log.target_type && log.target_id
                        ? `${log.target_type} ${String(log.target_id).slice(0, 8)}…`
                        : '—'}
                    </td>
                    <td
                      style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                      {log.ai_provider || '—'}
                    </td>
                    <td
                      style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)' }}
                    >
                      {log.duration_ms != null ? `${log.duration_ms}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
