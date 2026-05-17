import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Pause, Play, Zap, AlertTriangle, CheckCircle, Clock, RotateCcw } from 'lucide-react'
import { SectionProps, SectionCard, StatCard, tableHeaderStyle, tableCellStyle, AdminInput } from './shared'
import { supabase } from '../../lib/supabase'

interface AgentLog {
  id: string
  agent_name: string
  action: string
  status: 'ok' | 'warn' | 'error'
  target_type: string | null
  target_id: string | null
  contractor_id: string | null
  payload: Record<string, unknown>
  duration_ms: number | null
  created_at: string
}

interface BobControl {
  paused: boolean
  ai_provider_override: string | null
  lead_refresh_force: boolean
  max_leads_per_cycle: number
}

interface LeadStat {
  status: string
  count: number
}

const STATUS_COLOR: Record<string, string> = {
  ok: '#10B981',
  warn: '#F59E0B',
  error: '#EF4444',
}

const ACTION_COLOR: Record<string, string> = {
  lead_delivered: '#6366F1',
  lead_claimed: '#10B981',
  lead_passed: '#F97316',
  lead_expired: '#94A3B8',
  error: '#EF4444',
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function BobMonitorSection({ authHeaders }: SectionProps) {
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [controls, setControls] = useState<BobControl | null>(null)
  const [leadStats, setLeadStats] = useState<LeadStat[]>([])
  const [loading, setLoading] = useState(true)
  const [controlLoading, setControlLoading] = useState(false)
  const [err, setErr] = useState('')
  const [controlMsg, setControlMsg] = useState('')
  const [providerOverride, setProviderOverride] = useState('')
  const [maxLeads, setMaxLeads] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    setErr('')
    try {
      const [logsRes, controlsRes, statsRes] = await Promise.all([
        fetch('/api/admin/bob/logs?limit=50', { headers: authHeaders() }),
        fetch('/api/admin/bob/control', { headers: authHeaders() }),
        fetch('/api/admin/bob/lead-stats', { headers: authHeaders() }),
      ])
      if (logsRes.ok) setLogs((await logsRes.json()).logs ?? [])
      if (controlsRes.ok) {
        const c = await controlsRes.json()
        setControls(c)
        setProviderOverride(c.ai_provider_override ?? '')
        setMaxLeads(String(c.max_leads_per_cycle))
      }
      if (statsRes.ok) setLeadStats((await statsRes.json()).stats ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + realtime subscription
  useEffect(() => {
    void load()

    const channel = supabase
      .channel('admin-agent-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' }, payload => {
        setLogs(prev => [payload.new as AgentLog, ...prev].slice(0, 50))
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [load])

  // Auto-refresh every 15s
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => void load(), 15000)
    return () => clearInterval(t)
  }, [autoRefresh, load])

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

  const totalLogs = logs.length
  const errorCount = logs.filter(l => l.status === 'error').length
  const claimedCount = leadStats.find(s => s.status === 'claimed')?.count ?? 0
  const pendingCount = leadStats.find(s => s.status === 'pending')?.count ?? 0

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
        <StatCard label="Recent Actions" value={totalLogs} sub="last 50" icon={<Clock size={18} />} />
        <StatCard label="Errors" value={errorCount} sub="in recent logs" icon={<AlertTriangle size={18} />} color={errorCount > 0 ? '#EF4444' : '#10B981'} />
        <StatCard label="Leads Claimed" value={claimedCount} sub={`${pendingCount} pending`} icon={<CheckCircle size={18} />} color="#6366F1" />
      </div>

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
            style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, background: controls?.paused ? '#10B981' : '#EF4444' }}
          >
            {controls?.paused ? <><Play size={14} /> Resume Bob</> : <><Pause size={14} /> Pause Bob</>}
          </button>

          <button
            onClick={() => setControl('lead_refresh_force', 'true')}
            disabled={controlLoading}
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCcw size={14} /> Force Lead Refresh
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>AI Provider Override</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <AdminInput
                value={providerOverride}
                onChange={setProviderOverride}
                placeholder="e.g. openai or ollama (blank = default)"
                style={{ width: 240 }}
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
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>Max Leads / Cycle</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <AdminInput
                value={maxLeads}
                onChange={setMaxLeads}
                placeholder="10"
                style={{ width: 80 }}
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '4px 10px', color: autoRefresh ? '#10B981' : 'var(--color-text-muted)' }}
            >
              {autoRefresh ? '● Live' : '○ Paused'}
            </button>
            <button
              onClick={load}
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
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
                {['Time', 'Agent', 'Action', 'Status', 'Target', 'Duration', 'Details'].map(h => (
                  <th key={h} style={tableHeaderStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} style={{ padding: '10px 12px' }}>
                          <div style={{ height: 12, background: 'var(--color-border)', borderRadius: 4, opacity: 0.5 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} style={{ ...tableCellStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 32 }}>
                        No activity yet — Bob hasn't logged anything
                      </td>
                    </tr>
                  )
                  : logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {timeAgo(log.created_at)}
                      </td>
                      <td style={{ ...tableCellStyle, fontSize: 12 }}>{log.agent_name}</td>
                      <td style={tableCellStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: ACTION_COLOR[log.action] ?? 'var(--color-text)',
                          background: `${ACTION_COLOR[log.action] ?? '#888'}18`,
                          padding: '2px 7px', borderRadius: 10,
                        }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: STATUS_COLOR[log.status],
                        }}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {log.target_type && log.target_id
                          ? `${log.target_type} ${log.target_id.slice(0, 8)}…`
                          : '—'}
                      </td>
                      <td style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                      </td>
                      <td style={{ ...tableCellStyle, fontSize: 11, color: 'var(--color-text-muted)', maxWidth: 200 }}>
                        {Object.keys(log.payload).length > 0
                          ? <code style={{ fontSize: 10 }}>{JSON.stringify(log.payload).slice(0, 80)}</code>
                          : '—'}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
