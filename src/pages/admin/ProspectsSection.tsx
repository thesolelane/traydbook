import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Upload,
  RefreshCw,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  SkipForward,
  Plus,
  Eye,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from 'lucide-react'
import { SectionProps } from './shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Prospect {
  id: string
  prospect_type: string
  first_name: string
  last_name: string
  business_name: string
  city: string
  state: string
  license_number: string
  type_class: string
  status_description: string
  email_found: string | null
  email_subject: string | null
  email_body: string | null
  status: string
  import_batch: string
  created_at: string
  drafted_at: string | null
  sent_at: string | null
}

interface Stats {
  total: number
  unique_people: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

interface Template {
  id: string
  name: string
  prospect_type: string
  subject: string
  body_html: string
  body_text: string | null
  status: 'draft' | 'approved' | 'paused'
  touch_number: number | null
  created_at: string
  updated_at: string
}

interface DeliveryEvent {
  type: string
  timestamp: string
  metadata?: Record<string, unknown>
}

interface SendLogStats {
  total: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
}

interface SendLogEntry {
  id: string
  prospect_id: string
  template_id: string
  rendered_subject: string
  rendered_body_html: string
  delivery_status: string
  bob_job_id: string | null
  sent_at: string
  updated_at: string | null
  delivery_events: DeliveryEvent[]
  prospect: {
    id: string
    first_name: string
    last_name: string
    business_name: string
    email_found: string | null
    prospect_type: string
    city: string
    state: string
  } | null
  template: {
    id: string
    name: string
    prospect_type: string
  } | null
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending: '#e0b852',
  enriched: 'var(--color-brand)',
  drafted: '#7c70e8',
  sent: '#52c97a',
  replied: '#10B981',
  skipped: '#888',
  bounced: '#e05252',
  converted: '#34d399',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  enriched: <Mail size={12} />,
  drafted: <Mail size={12} />,
  sent: <CheckCircle size={12} />,
  replied: <CheckCircle size={12} />,
  skipped: <SkipForward size={12} />,
  bounced: <XCircle size={12} />,
  converted: <UserCheck size={12} />,
}

const MERGE_TAGS = [
  '{{first_name}}',
  '{{trade}}',
  '{{city}}',
  '{{license_number}}',
  '{{state}}',
  '{{unsubscribe_url}}',
]

const TMPL_STATUS_COLOR: Record<string, string> = {
  draft: '#e0b852',
  approved: '#52c97a',
  paused: '#888',
}

const DELIVERY_COLOR: Record<string, string> = {
  sent: '#52c97a',
  delivered: '#10B981',
  bounced: '#e05252',
  failed: '#e05252',
  opened: '#7c70e8',
  clicked: '#3b82f6',
}

const DELIVERY_EVENT_ICON: Record<string, string> = {
  sent: '📤',
  delivered: '✅',
  bounced: '🚫',
  failed: '❌',
  opened: '👁️',
  clicked: '🖱️',
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 7,
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: 13,
  boxSizing: 'border-box',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  const tabs = [
    { id: 'prospects', label: 'Prospects' },
    { id: 'templates', label: 'Email Templates' },
    { id: 'send-log', label: 'Send Log' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
      }}
    >
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: active === t.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
            borderBottom:
              active === t.id ? '2px solid var(--color-brand)' : '2px solid transparent',
            marginBottom: -1,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Prospects tab (existing) ─────────────────────────────────────────────────

function ProspectsTab({ authHeaders }: SectionProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [importJob, setImportJob] = useState<{
    batchId: string
    total: number
    processed: number
    imported: number
    done: boolean
    error: string | null
    warning: string | null
  } | null>(null)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [typeClassFilter, setTypeClassFilter] = useState('')
  const [typeClasses, setTypeClasses] = useState<string[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bounceLogs, setBounceLogs] = useState<Record<string, SendLogEntry | null>>({})
  const [bounceLoading, setBounceLoading] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false) // sync guard — prevents double-fire from programmatic input clear
  const [prospectType, setProspectType] = useState<'contractor' | 'real_estate_agent'>('contractor')
  const [matchStatus, setMatchStatus] = useState<{ last_run: string | null; next_run: string | null } | null>(null)
  const [matchRunning, setMatchRunning] = useState(false)
  const [matchResult, setMatchResult] = useState<{ matched: number; users_checked: number } | null>(null)

  const loadMatchStatus = useCallback(async () => {
    const res = await fetch('/api/admin/prospects/match-status', { headers: authHeaders() })
    if (res.ok) setMatchStatus(await res.json())
  }, [])

  async function runMatch() {
    setMatchRunning(true)
    setMatchResult(null)
    try {
      const res = await fetch('/api/admin/prospects/run-match', {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (res.ok) {
        setMatchResult({ matched: data.matched, users_checked: data.users_checked })
        await loadMatchStatus()
        await loadStats()
      } else {
        setErr(data.error || 'Match scan failed')
      }
    } finally {
      setMatchRunning(false)
    }
  }

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/prospects/stats', { headers: authHeaders() })
    if (res.ok) setStats(await res.json())
  }, [])

  const loadTypeClasses = useCallback(async (pt?: string) => {
    const params = new URLSearchParams()
    if (pt) params.set('prospect_type', pt)
    const res = await fetch(`/api/admin/prospects/type-classes?${params}`, {
      headers: authHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      setTypeClasses(data.type_classes || [])
    }
  }, [])

  const loadProspects = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '100', status: statusFilter })
      if (typeFilter) params.set('prospect_type', typeFilter)
      if (typeClassFilter) params.set('type_class', typeClassFilter)
      const res = await fetch(`/api/admin/prospects?${params}`, { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load prospects')
      setProspects(data.prospects || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, typeClassFilter])

  // Mount only — stats, type-classes, and match status don't need to re-run on filter changes
  useEffect(() => {
    void loadStats()
    void loadTypeClasses()
    void loadMatchStatus()
  }, [loadStats, loadTypeClasses, loadMatchStatus])

  // Prospects reload only when filter state changes (loadProspects ref changes with filters)
  useEffect(() => {
    void loadProspects()
  }, [loadProspects])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Sync guard — React state (uploading) may not be true yet on a double-fire
    // caused by programmatically clearing the input value below.
    if (isUploadingRef.current) return
    isUploadingRef.current = true
    setUploading(true)
    setErr('')
    setSuccess('')
    setImportJob(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('prospect_type', prospectType)
      const res = await fetch('/api/admin/prospects/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      // Clear the input AFTER the request so browsers don't re-fire onChange
      if (fileRef.current) fileRef.current.value = ''

      // Server accepted — start polling for background progress
      const batchId = data.batch_id
      const total = data.total
      setImportJob({ batchId, total, processed: 0, imported: 0, done: false, error: null, warning: null })
      setUploading(false)
      isUploadingRef.current = false

      let pollFailures = 0
      const MAX_POLL_FAILURES = 3
      const poll = async () => {
        try {
          const r = await fetch(`/api/admin/prospects/import-status/${batchId}`, {
            headers: authHeaders(),
          })
          // 404 = job gone (server restarted mid-import) — stop immediately
          if (r.status === 404) {
            setErr('Import job was lost — the server may have restarted during the upload. Check the database to confirm how many rows were inserted, then retry if needed.')
            setUploading(false)
            isUploadingRef.current = false
            return
          }
          // Other non-ok (429, 5xx) = transient — retry up to MAX_POLL_FAILURES times
          if (!r.ok) {
            pollFailures++
            if (pollFailures >= MAX_POLL_FAILURES) {
              setErr(`Import status check failed after ${MAX_POLL_FAILURES} attempts (HTTP ${r.status}). The import may still be running in the background.`)
              return
            }
            setTimeout(poll, 5000)
            return
          }
          pollFailures = 0
          const job = await r.json()
          setImportJob({
            batchId,
            total: job.total,
            processed: job.processed,
            imported: job.imported,
            done: job.done,
            error: job.error ?? null,
            warning: job.warning ?? null,
          })
          if (!job.done) {
            setTimeout(poll, 4000)
          } else {
            if (job.error) {
              setErr(`Import error: ${job.error}`)
            } else {
              setSuccess(
                `✓ Imported ${(job.imported ?? 0).toLocaleString()} of ${(job.total ?? 0).toLocaleString()} prospects (batch: ${batchId})` +
                (job.warning ? ` — ⚠ ${job.warning}` : '')
              )
            }
            await loadStats()
            await loadTypeClasses(prospectType)
            await loadProspects()
          }
        } catch {
          setTimeout(poll, 5000)
        }
      }
      setTimeout(poll, 2000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
      isUploadingRef.current = false
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function markSent(id: string) {
    await fetch(`/api/admin/prospects/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
    })
    await loadProspects()
  }

  async function markSkipped(id: string) {
    await fetch(`/api/admin/prospects/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'skipped', skip_reason: 'admin_skipped' }),
    })
    await loadProspects()
  }

  async function fetchBounceLog(id: string) {
    if (bounceLogs[id] !== undefined || bounceLoading[id]) return
    setBounceLoading(prev => ({ ...prev, [id]: true }))
    try {
      const res = await fetch(`/api/admin/prospects/${id}/send-log`, { headers: authHeaders() })
      const data = res.ok ? await res.json() : null
      setBounceLogs(prev => ({ ...prev, [id]: data }))
    } catch {
      setBounceLogs(prev => ({ ...prev, [id]: null }))
    } finally {
      setBounceLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  function handleExpand(p: Prospect) {
    const next = expanded === p.id ? null : p.id
    setExpanded(next)
    if (next && p.status === 'bounced') void fetchBounceLog(p.id)
  }

  const statuses = ['pending', 'enriched', 'drafted', 'sent', 'replied', 'skipped', 'bounced', 'converted']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Records', value: stats.total, color: 'var(--color-text)' },
            { label: 'Unique People', value: stats.unique_people || 0, color: '#38bdf8' },
            {
              label: 'Contractors',
              value: stats.by_type.contractor || 0,
              color: 'var(--color-brand)',
            },
            { label: 'RE Agents', value: stats.by_type.real_estate_agent || 0, color: '#7c70e8' },
            { label: 'Pending', value: stats.by_status.pending || 0, color: '#e0b852' },
            { label: 'Drafted', value: stats.by_status.drafted || 0, color: '#7c70e8' },
            { label: 'Sent', value: stats.by_status.sent || 0, color: '#52c97a' },
            { label: 'Bounced', value: stats.by_status.bounced || 0, color: '#e05252' },
            { label: 'Converted', value: stats.by_status.converted || 0, color: '#34d399' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '12px 18px',
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>
                {s.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Match Users panel ─────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <UserCheck size={16} color="#34d399" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>User Match Scan</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {matchStatus?.last_run
              ? `Last run: ${new Date(matchStatus.last_run).toLocaleString()} · Next auto-run: ${new Date(matchStatus.next_run!).toLocaleDateString()}`
              : 'Never run — click to scan now'}
          </div>
          {matchResult && (
            <div style={{ fontSize: 11, color: '#34d399', marginTop: 4 }}>
              ✓ Scan complete — {matchResult.matched} prospect(s) converted across {matchResult.users_checked.toLocaleString()} users checked
            </div>
          )}
        </div>
        <button
          onClick={runMatch}
          disabled={matchRunning}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #34d399',
            background: matchRunning ? 'var(--color-surface)' : '#34d39922',
            color: '#34d399',
            fontSize: 12,
            fontWeight: 600,
            cursor: matchRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {matchRunning ? <RefreshCw size={12} className="spin" /> : <UserCheck size={12} />}
          {matchRunning ? 'Scanning…' : 'Run Now'}
        </button>
      </div>

      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: 20,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Upload size={15} color="var(--color-brand)" /> Import CSV
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['contractor', 'real_estate_agent'] as const).map(t => (
              <button
                key={t}
                onClick={() => setProspectType(t)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border:
                    prospectType === t
                      ? '1px solid var(--color-brand)'
                      : '1px solid var(--color-border)',
                  background: prospectType === t ? 'rgba(226,114,42,0.15)' : 'var(--color-bg)',
                  color: prospectType === t ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {t === 'contractor' ? '🔨 Contractor' : '🏠 RE Agent'}
              </button>
            ))}
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 8,
              background: uploading ? 'var(--color-surface-2)' : 'var(--color-brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Choose CSV'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Max 50MB · Deduplicates by license number
          </span>
        </div>
        {importJob && !importJob.done && (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                marginBottom: 6,
              }}
            >
              <span>
                Importing… {importJob.processed.toLocaleString()} /{' '}
                {importJob.total.toLocaleString()} rows
              </span>
              <span>
                {importJob.total > 0
                  ? Math.round((importJob.processed / importJob.total) * 100)
                  : 0}
                %
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 4,
                background: 'var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 4,
                  background: 'var(--color-brand)',
                  width: `${importJob.total > 0 ? Math.round((importJob.processed / importJob.total) * 100) : 0}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}
        {success && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#1a3a25',
              border: '1px solid #52c97a',
              borderRadius: 6,
              color: '#52c97a',
              fontSize: 13,
            }}
          >
            {success}
          </div>
        )}
        {err && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#3a1a1a',
              border: '1px solid #e05252',
              borderRadius: 6,
              color: '#e05252',
              fontSize: 13,
            }}
          >
            {err}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* All-statuses button */}
        <button
          onClick={() => setStatusFilter('')}
          style={{
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            border: statusFilter === '' ? '1px solid var(--color-text-muted)' : '1px solid var(--color-border)',
            background: statusFilter === '' ? 'rgba(255,255,255,0.08)' : 'var(--color-surface)',
            color: statusFilter === '' ? 'var(--color-text)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          All {stats && !statusFilter ? `(${stats.total.toLocaleString()})` : ''}
        </button>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(prev => prev === s ? '' : s)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border:
                statusFilter === s
                  ? `1px solid ${STATUS_COLOR[s]}`
                  : '1px solid var(--color-border)',
              background: statusFilter === s ? STATUS_COLOR[s] + '22' : 'var(--color-surface)',
              color: statusFilter === s ? STATUS_COLOR[s] : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {STATUS_ICON[s]} {s} {stats?.by_status[s] ? `(${stats.by_status[s].toLocaleString()})` : ''}
          </button>
        ))}
        {/* Type filter — two explicit toggles instead of a 3-state cycle */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {([
            { value: 'contractor', label: '🔨 Contractors' },
            { value: 'real_estate_agent', label: '🏠 RE Agents' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                const next = typeFilter === value ? '' : value
                setTypeFilter(next)
                setTypeClassFilter('')
                void loadTypeClasses(next || undefined)
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: typeFilter === value ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: typeFilter === value ? 'rgba(226,114,42,0.15)' : 'var(--color-surface)',
                color: typeFilter === value ? 'var(--color-brand)' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {typeClasses.length > 0 && (
          <select
            value={typeClassFilter}
            onChange={e => setTypeClassFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: 20,
              fontSize: 12,
              border: typeClassFilter ? '1px solid #7c70e8' : '1px solid var(--color-border)',
              background: typeClassFilter ? 'rgba(124,112,232,0.1)' : 'var(--color-surface)',
              color: typeClassFilter ? '#7c70e8' : 'var(--color-text-muted)',
              cursor: 'pointer',
              maxWidth: 200,
            }}
          >
            <option value="">All License Types</option>
            {typeClasses.map(tc => (
              <option key={tc} value={tc}>
                {tc}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            void loadStats()
            void loadTypeClasses(typeFilter || undefined)
            void loadProspects()
          }}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
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

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
      ) : prospects.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 40,
          }}
        >
          No {statusFilter} prospects{typeFilter ? ` (${typeFilter})` : ''}
          {typeClassFilter ? ` · ${typeClassFilter}` : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prospects.map(p => (
            <div
              key={p.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => handleExpand(p)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: (STATUS_COLOR[p.status] || '#888') + '22',
                    color: STATUS_COLOR[p.status] || '#888',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {STATUS_ICON[p.status]} {p.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {p.first_name} {p.last_name}
                  {p.business_name && (
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      {' '}
                      — {p.business_name}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {p.city}, {p.state}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {p.type_class}
                </span>
                {p.email_found && (
                  <span style={{ fontSize: 11, color: '#52c97a', marginLeft: 'auto' }}>
                    ✓ {p.email_found}
                  </span>
                )}
                {p.prospect_type === 'real_estate_agent' && (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#7c70e8',
                      marginLeft: p.email_found ? 8 : 'auto',
                    }}
                  >
                    🏠 RE
                  </span>
                )}
              </div>

              {expanded === p.id && (
                <div
                  style={{
                    padding: '0 16px 16px',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <strong>License:</strong> {p.license_number || '—'}
                    </div>
                    <div>
                      <strong>Status:</strong> {p.status_description || '—'}
                    </div>
                    <div>
                      <strong>Email:</strong> {p.email_found || 'Not found yet'}
                    </div>
                    <div>
                      <strong>Batch:</strong> {p.import_batch}
                    </div>
                    <div>
                      <strong>Imported:</strong> {new Date(p.created_at).toLocaleDateString()}
                    </div>
                    {p.sent_at && (
                      <div>
                        <strong>Sent:</strong> {new Date(p.sent_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {p.email_body && (
                    <div
                      style={{
                        background: 'var(--color-bg)',
                        borderRadius: 6,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          marginBottom: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        Email Draft
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                        {p.email_subject}
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 11,
                          color: 'var(--color-text)',
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'var(--font-sans)',
                          lineHeight: 1.6,
                        }}
                      >
                        {p.email_body}
                      </pre>
                    </div>
                  )}

                  {p.status === 'drafted' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => markSent(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#1a3a25',
                          color: '#52c97a',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle size={13} /> Mark Sent
                      </button>
                      <button
                        onClick={() => markSkipped(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: '1px solid var(--color-border)',
                          background: 'none',
                          color: 'var(--color-text-muted)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <XCircle size={13} /> Skip
                      </button>
                    </div>
                  )}

                  {p.status === 'bounced' &&
                    (() => {
                      const log = bounceLogs[p.id]
                      const isLoading = bounceLoading[p.id]
                      const bounceEvent = log?.delivery_events?.find(
                        (e: DeliveryEvent) => e.type === 'bounced' || e.type === 'failed'
                      )
                      const meta = bounceEvent?.metadata as Record<string, unknown> | undefined

                      return (
                        <div
                          style={{
                            background: '#2a1515',
                            border: '1px solid #e05252',
                            borderRadius: 6,
                            padding: 12,
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color: '#e05252',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              fontWeight: 700,
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <XCircle size={12} /> Bounce Details
                          </div>
                          {isLoading ? (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              Loading…
                            </div>
                          ) : !log ? (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              No send-log entry found for this prospect.
                            </div>
                          ) : !bounceEvent ? (
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                              Send log found (status: <strong>{log.delivery_status}</strong>) but no
                              bounce event recorded yet.
                            </div>
                          ) : (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 6,
                                fontSize: 12,
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <div>
                                <strong style={{ color: 'var(--color-text)' }}>Event:</strong>{' '}
                                {bounceEvent.type}
                              </div>
                              <div>
                                <strong style={{ color: 'var(--color-text)' }}>Time:</strong>{' '}
                                {new Date(bounceEvent.timestamp).toLocaleString()}
                              </div>
                              {!!meta?.bounce_type && (
                                <div>
                                  <strong style={{ color: 'var(--color-text)' }}>Type:</strong>{' '}
                                  {String(meta.bounce_type)}
                                </div>
                              )}
                              {!!meta?.smtp_code && (
                                <div>
                                  <strong style={{ color: 'var(--color-text)' }}>SMTP Code:</strong>{' '}
                                  {String(meta.smtp_code)}
                                </div>
                              )}
                              {!!meta?.reason && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: 'var(--color-text)' }}>Reason:</strong>{' '}
                                  {String(meta.reason)}
                                </div>
                              )}
                              {!!meta?.message && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: 'var(--color-text)' }}>Message:</strong>{' '}
                                  {String(meta.message)}
                                </div>
                              )}
                              {!!meta?.description && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: 'var(--color-text)' }}>
                                    Description:
                                  </strong>{' '}
                                  {String(meta.description)}
                                </div>
                              )}
                              {!!meta?.diagnostic_code && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <strong style={{ color: 'var(--color-text)' }}>
                                    Diagnostic:
                                  </strong>{' '}
                                  {String(meta.diagnostic_code)}
                                </div>
                              )}
                              {log.rendered_subject && (
                                <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                                  <strong style={{ color: 'var(--color-text)' }}>
                                    Subject sent:
                                  </strong>{' '}
                                  {log.rendered_subject}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                  {p.status === 'pending' && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Waiting for Bob to enrich and draft an email.
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

// ─── Template editor modal ────────────────────────────────────────────────────

interface TemplateEditorProps {
  initial: Partial<Template> | null
  onSave: (t: Template) => void
  onClose: () => void
  authHeaders: () => Record<string, string>
}

function TemplateEditor({ initial, onSave, onClose, authHeaders }: TemplateEditorProps) {
  const [name, setName] = useState(initial?.name || '')
  const [type, setType] = useState(initial?.prospect_type || 'contractor')
  const [touchNumber, setTouchNumber] = useState<string>(String(initial?.touch_number ?? ''))
  const [subject, setSubject] = useState(initial?.subject || '')
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html || '')
  const [bodyText, setBodyText] = useState(initial?.body_text || '')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setErr('Name, subject, and HTML body are required.')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const isEdit = !!initial?.id
      const res = await fetch(
        isEdit ? `/api/admin/outreach/templates/${initial!.id}` : '/api/admin/outreach/templates',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            prospect_type: type,
            subject,
            body_html: bodyHtml,
            body_text: bodyText,
            touch_number: touchNumber ? parseInt(touchNumber) : null,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSave(data)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const PHYSICAL_ADDRESS =
    import.meta.env.VITE_PHYSICAL_ADDRESS ||
    '[⚠ PHYSICAL_ADDRESS NOT SET — configure VITE_PHYSICAL_ADDRESS before sending live emails]'
  const PREVIEW_FOOTER_HTML = `<!-- traydbook-footer -->
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e0e0e0;font-family:Arial,sans-serif;font-size:12px;color:#888;text-align:center;line-height:1.7;">
  <p style="margin:0 0 6px 0;">This is a commercial message from TraydBook. You received this email because your contact information appears in licensed contractor public records.</p>
  <p style="margin:0 0 6px 0;">${PHYSICAL_ADDRESS}</p>
  <p style="margin:0;"><a href="#" style="color:#666;text-decoration:underline;">Unsubscribe</a> — to stop receiving emails from TraydBook, click the link above.</p>
</div>`

  const sampleProspect = {
    first_name: 'Alex',
    trade: 'General Contractor',
    city: 'Austin',
    license_number: 'GC-12345',
    state: 'TX',
  }
  function renderPreview(s: string, isHtml = false) {
    const filled = s
      .replace(/\{\{first_name\}\}/g, sampleProspect.first_name)
      .replace(/\{\{trade\}\}/g, sampleProspect.trade)
      .replace(/\{\{city\}\}/g, sampleProspect.city)
      .replace(/\{\{license_number\}\}/g, sampleProspect.license_number)
      .replace(/\{\{state\}\}/g, sampleProspect.state)
      .replace(/\{\{unsubscribe_url\}\}/g, '#')
    return isHtml ? filled + PREVIEW_FOOTER_HTML : filled
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial?.id ? 'Edit Template' : 'New Template'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Template Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Contractor Welcome Outreach"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Audience
            </label>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              <option value="contractor">🔨 Contractor</option>
              <option value="homeowner">🏡 Homeowner</option>
              <option value="real_estate_agent">🏠 Real Estate Agent</option>
              <option value="investor_flipper">💼 Investor — Flipper</option>
              <option value="investor_buy_hold">🏘 Investor — Buy & Hold</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Touch # (sequence)
            </label>
            <select
              value={touchNumber}
              onChange={e => setTouchNumber(e.target.value)}
              style={inputStyle}
            >
              <option value="">— unset —</option>
              <option value="1">1 — Cold Introduction</option>
              <option value="2">2 — Second Touch</option>
              <option value="3">3 — Final Touch</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Subject Line
          </label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. {{first_name}}, grow your business in {{city}}"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              alignSelf: 'center',
              marginRight: 4,
            }}
          >
            Merge tags:
          </span>
          {MERGE_TAGS.map(tag => (
            <code
              key={tag}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-brand)',
                cursor: 'pointer',
              }}
              title="Click to copy"
              onClick={() => navigator.clipboard?.writeText(tag)}
            >
              {tag}
            </code>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 4,
          }}
        >
          {['editor', 'preview'].map(m => (
            <button
              key={m}
              onClick={() => setPreview(m === 'preview')}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: (preview ? m === 'preview' : m === 'editor')
                  ? 'var(--color-brand)'
                  : 'var(--color-text-muted)',
                borderBottom: (preview ? m === 'preview' : m === 'editor')
                  ? '2px solid var(--color-brand)'
                  : '2px solid transparent',
                marginBottom: -5,
              }}
            >
              {m === 'editor' ? 'HTML Editor' : '👁 Preview'}
            </button>
          ))}
        </div>

        {!preview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                HTML Body
              </label>
              <textarea
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                rows={10}
                placeholder="<p>Hi {{first_name}},</p>..."
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Plain Text Body <span style={{ fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={bodyText}
                onChange={e => setBodyText(e.target.value)}
                rows={4}
                placeholder="Hi {{first_name}}, ..."
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--color-bg)',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 12,
              }}
            >
              <strong>Subject:</strong>{' '}
              {renderPreview(subject) || (
                <span style={{ color: 'var(--color-text-muted)' }}>(empty)</span>
              )}
            </div>
            <iframe
              sandbox=""
              srcDoc={
                renderPreview(bodyHtml, true) || '<em style="color:#999">No HTML content yet.</em>'
              }
              style={{ width: '100%', height: 200, border: 'none', background: '#fff' }}
              title="Email preview"
            />
          </div>
        )}

        {err && (
          <div
            style={{
              padding: '8px 12px',
              background: '#2a1515',
              border: '1px solid #e05252',
              borderRadius: 6,
              color: '#e05252',
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 7,
              border: '1px solid var(--color-border)',
              background: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 22px',
              borderRadius: 7,
              border: 'none',
              background: saving ? 'var(--color-surface-2)' : 'var(--color-brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────

const AUDIENCE_GROUPS = [
  { type: 'contractor', label: '🔨 Contractor' },
  { type: 'homeowner', label: '🏡 Homeowner' },
  { type: 'real_estate_agent', label: '🏠 Real Estate Agent' },
  { type: 'investor_flipper', label: '💼 Investor — Flipper' },
  { type: 'investor_buy_hold', label: '🏘 Investor — Buy & Hold' },
  { type: 'other', label: '⋯ Other' },
]

function MasterToggle({
  on,
  toggling,
  onToggle,
}: {
  on: boolean
  toggling: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      title={
        on
          ? 'All approved — click to pause entire audience'
          : 'Click to approve all templates in this audience'
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'none',
        border: 'none',
        cursor: toggling ? 'wait' : 'pointer',
        padding: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: on ? '#52c97a' : 'var(--color-text-muted)',
          opacity: toggling ? 0.5 : 1,
        }}
      >
        {on ? 'ALL ON' : 'ALL OFF'}
      </span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          width: 40,
          height: 22,
          borderRadius: 11,
          background: on ? '#52c97a' : 'var(--color-border)',
          transition: 'background 0.2s',
          padding: '0 3px',
          opacity: toggling ? 0.5 : 1,
        }}
      >
        <span
          style={{
            display: 'block',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transform: on ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </span>
    </button>
  )
}

function TemplatePreviewModal({
  subject,
  bodyHtml,
  onClose,
}: {
  subject: string
  bodyHtml: string
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={e => {
        if (e.target === overlayRef.current) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border)',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--color-text-muted)',
              }}
            >
              Email Preview
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                wordBreak: 'break-word',
              }}
            >
              {subject || '(no subject)'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
              marginTop: -2,
            }}
            aria-label="Close preview"
          >
            ×
          </button>
        </div>
        {/* Rendered email */}
        <iframe
          srcDoc={
            bodyHtml ||
            '<p style="color:#999;font-family:sans-serif;padding:20px">No HTML content.</p>'
          }
          sandbox="allow-same-origin"
          title="Email preview"
          style={{ flex: 1, border: 'none', minHeight: 400, background: '#fff' }}
        />
      </div>
    </div>
  )
}

function TemplatesTab({ authHeaders }: SectionProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<Partial<Template> | null | false>(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<{ subject: string; bodyHtml: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/outreach/templates', { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status} — Failed to load templates`)
      setTemplates(data.templates || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(id: string, status: 'draft' | 'approved' | 'paused') {
    await fetch(`/api/admin/outreach/templates/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function masterToggle(type: string, groupTemplates: Template[]) {
    const allApproved = groupTemplates.every(t => t.status === 'approved')
    const newStatus = allApproved ? 'paused' : 'approved'
    setToggling(type)
    try {
      await Promise.all(
        groupTemplates.map(t =>
          fetch(`/api/admin/outreach/templates/${t.id}`, {
            method: 'PATCH',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      )
      await load()
    } finally {
      setToggling(null)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await fetch(`/api/admin/outreach/templates/${id}`, { method: 'DELETE', headers: authHeaders() })
    await load()
  }

  const grouped = AUDIENCE_GROUPS.map(g => ({
    ...g,
    items: templates.filter(t => t.prospect_type === g.type),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => setEditing({})}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-brand)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> New Template
        </button>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-muted)',
          padding: '8px 12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
        }}
      >
        <strong style={{ color: 'var(--color-text)' }}>How it works:</strong> Bob picks the latest{' '}
        <span style={{ color: '#52c97a' }}>approved</span> template matching a prospect's type,
        fills the merge tags, sends the email autonomously, and logs it to the Send Log — no
        per-email review needed. <span style={{ color: '#e0b852' }}>Draft</span> templates are
        ignored. Set to <span style={{ color: '#888' }}>paused</span> to kill-switch a template. Use
        the audience master toggle to turn an entire sequence on or off at once.
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
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading templates...</div>
      ) : grouped.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 40,
          }}
        >
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map(({ type, label, items }) => {
            const allApproved = items.every(t => t.status === 'approved')
            const anyApproved = items.some(t => t.status === 'approved')
            return (
              <div key={type}>
                {/* Audience header + master toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: allApproved
                      ? '#1a3a2518'
                      : anyApproved
                        ? '#2a2a1a18'
                        : 'var(--color-surface)',
                    border: `1px solid ${allApproved ? '#52c97a44' : 'var(--color-border)'}`,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {items.filter(t => t.status === 'approved').length}/{items.length} active
                    </span>
                  </div>
                  <MasterToggle
                    on={allApproved}
                    toggling={toggling === type}
                    onToggle={() => masterToggle(type, items)}
                  />
                </div>

                {/* Individual template cards */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    paddingLeft: 12,
                    borderLeft: `2px solid ${allApproved ? '#52c97a44' : 'var(--color-border)'}`,
                  }}
                >
                  {items
                    .sort((a, b) => (a.touch_number ?? 99) - (b.touch_number ?? 99))
                    .map(t => (
                      <div
                        key={t.id}
                        style={{
                          background: 'var(--color-surface)',
                          border: `1px solid ${t.status === 'approved' ? '#52c97a33' : 'var(--color-border)'}`,
                          borderRadius: 8,
                          padding: '14px 16px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700,
                              background: (TMPL_STATUS_COLOR[t.status] || '#888') + '22',
                              color: TMPL_STATUS_COLOR[t.status] || '#888',
                              textTransform: 'uppercase',
                              letterSpacing: '0.4px',
                            }}
                          >
                            {t.status}
                          </span>
                          {t.touch_number && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--color-text-muted)',
                                fontWeight: 600,
                              }}
                            >
                              Touch {t.touch_number}
                            </span>
                          )}
                          <span
                            style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}
                          >
                            {t.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--color-text-muted)',
                              marginLeft: 'auto',
                            }}
                          >
                            {new Date(t.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 5 }}
                        >
                          <strong>Subject:</strong> {t.subject}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          <button
                            onClick={() =>
                              setPreviewing({ subject: t.subject, bodyHtml: t.body_html || '' })
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 5,
                              border: '1px solid var(--color-border)',
                              background: 'none',
                              color: 'var(--color-text-muted)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <Eye size={11} /> Preview
                          </button>
                          <button
                            onClick={() => setEditing(t)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 10px',
                              borderRadius: 5,
                              border: '1px solid var(--color-border)',
                              background: 'none',
                              color: 'var(--color-text-muted)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          {t.status !== 'approved' && (
                            <button
                              onClick={() => updateStatus(t.id, 'approved')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 5,
                                border: '1px solid #52c97a44',
                                background: '#1a3a2522',
                                color: '#52c97a',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Play size={11} /> Approve
                            </button>
                          )}
                          {t.status === 'approved' && (
                            <button
                              onClick={() => updateStatus(t.id, 'paused')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 5,
                                border: '1px solid #88888844',
                                background: 'none',
                                color: '#888',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              <Pause size={11} /> Pause
                            </button>
                          )}
                          {t.status === 'paused' && (
                            <button
                              onClick={() => updateStatus(t.id, 'draft')}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 5,
                                border: '1px solid #e0b85244',
                                background: 'none',
                                color: '#e0b852',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Back to Draft
                            </button>
                          )}
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginLeft: 'auto',
                              padding: '4px 10px',
                              borderRadius: 5,
                              border: '1px solid #e0525222',
                              background: 'none',
                              color: '#e05252',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing !== false && (
        <TemplateEditor
          initial={editing}
          authHeaders={authHeaders}
          onClose={() => setEditing(false)}
          onSave={() => {
            setEditing(false)
            void load()
          }}
        />
      )}

      {previewing && (
        <TemplatePreviewModal
          subject={previewing.subject}
          bodyHtml={previewing.bodyHtml}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  )
}

// ─── Send Log tab ─────────────────────────────────────────────────────────────

// Helper: compute sent_after / sent_before from a preset string
function dateRangeFromPreset(preset: string): { sentAfter: string; sentBefore: string } | null {
  if (preset === 'custom' || preset === '') return null
  const now = new Date()
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : null
  if (!days) return null
  const after = new Date(now)
  after.setDate(after.getDate() - days)
  return { sentAfter: after.toISOString(), sentBefore: now.toISOString() }
}

function SendLogTab({ authHeaders }: SectionProps) {
  const [logs, setLogs] = useState<SendLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<SendLogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [datePreset, setDatePreset] = useState('') // '', '7d', '30d', '90d', 'custom'
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Derive the ISO range to send to the API
  const derivedRange = datePreset === 'custom'
    ? {
        sentAfter: customFrom ? new Date(customFrom).toISOString() : '',
        sentBefore: customTo ? new Date(customTo + 'T23:59:59').toISOString() : '',
      }
    : (dateRangeFromPreset(datePreset) ?? { sentAfter: '', sentBefore: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter) params.set('delivery_status', statusFilter)

      // Date range — recompute inside callback so it always reflects the latest state
      const range = datePreset === 'custom'
        ? {
            sentAfter: customFrom ? new Date(customFrom).toISOString() : '',
            sentBefore: customTo ? new Date(customTo + 'T23:59:59').toISOString() : '',
          }
        : (dateRangeFromPreset(datePreset) ?? { sentAfter: '', sentBefore: '' })

      if (range.sentAfter) params.set('sent_after', range.sentAfter)
      if (range.sentBefore) params.set('sent_before', range.sentBefore)

      const res = await fetch(`/api/admin/outreach/send-log?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load send log')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      if (data.stats) setStats(data.stats)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, datePreset, customFrom, customTo])

  useEffect(() => {
    void load()
  }, [load])

  const deliveryStatuses = ['', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed']

  const pct = (n: number) =>
    stats && stats.total > 0 ? Math.round((n / stats.total) * 100) : 0

  const datePresets = [
    { value: '', label: 'All time' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom…' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Delivery stats summary bar ─────────────────────────────── */}
      {stats && stats.total > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Sent', value: stats.total.toLocaleString(), color: 'var(--color-text)', sub: null },
            { label: 'Delivered', value: `${pct(stats.delivered)}%`, color: '#10B981', sub: stats.delivered.toLocaleString() },
            { label: 'Opened', value: `${pct(stats.opened)}%`, color: '#7c70e8', sub: stats.opened.toLocaleString() },
            { label: 'Clicked', value: `${pct(stats.clicked)}%`, color: '#3b82f6', sub: stats.clicked.toLocaleString() },
            { label: 'Bounced', value: `${pct(stats.bounced)}%`, color: '#e05252', sub: stats.bounced.toLocaleString() },
          ].map(card => (
            <div
              key={card.label}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '12px 18px',
                minWidth: 100,
                flex: '1 1 0',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {card.label}
              </div>
              {card.sub !== null && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2, opacity: 0.7 }}>
                  {card.sub} emails
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Date range picker ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {datePresets.map(p => (
          <button
            key={p.value}
            onClick={() => setDatePreset(p.value)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: datePreset === p.value
                ? '1px solid var(--color-brand)'
                : '1px solid var(--color-border)',
              background: datePreset === p.value
                ? 'rgba(226,114,42,0.15)'
                : 'var(--color-surface)',
              color: datePreset === p.value
                ? 'var(--color-brand)'
                : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {datePreset === 'custom' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              From
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              To
            </label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 12,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Status filter + refresh ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {deliveryStatuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border:
                statusFilter === s
                  ? `1px solid ${DELIVERY_COLOR[s] || 'var(--color-brand)'}`
                  : '1px solid var(--color-border)',
              background:
                statusFilter === s
                  ? (DELIVERY_COLOR[s] || 'var(--color-brand)') + '22'
                  : 'var(--color-surface)',
              color:
                statusFilter === s
                  ? DELIVERY_COLOR[s] || 'var(--color-brand)'
                  : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            {s || 'All'}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {total > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {total.toLocaleString()} emails
          {derivedRange.sentAfter || derivedRange.sentBefore
            ? ' in selected range'
            : ' sent total'}
        </div>
      )}

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
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading send log...</div>
      ) : logs.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 40,
          }}
        >
          No emails sent yet{statusFilter ? ` with status "${statusFilter}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map(entry => (
            <div
              key={entry.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <div
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: (DELIVERY_COLOR[entry.delivery_status] || '#888') + '22',
                    color: DELIVERY_COLOR[entry.delivery_status] || '#888',
                    textTransform: 'uppercase',
                  }}
                >
                  {entry.delivery_status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {entry.prospect?.first_name} {entry.prospect?.last_name}
                  {entry.prospect?.business_name && (
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      {' '}
                      — {entry.prospect.business_name}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {entry.prospect?.email_found || '—'}
                </span>
                <span style={{ fontSize: 11, color: '#7c70e8', marginLeft: 4 }}>
                  via {entry.template?.name || 'Unknown template'}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {new Date(entry.sent_at).toLocaleString()}
                  {expanded === entry.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </div>

              {expanded === entry.id && (
                <div
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <strong>Subject:</strong> {entry.rendered_subject}
                  </div>
                  {entry.bob_job_id && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      <strong>Bob Job ID:</strong> {entry.bob_job_id}
                    </div>
                  )}

                  {/* Delivery event timeline */}
                  {entry.delivery_events && entry.delivery_events.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          marginBottom: 8,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: 600,
                        }}
                      >
                        Delivery Timeline
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {entry.delivery_events.map((ev, i) => (
                          <div
                            key={i}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
                          >
                            <span style={{ fontSize: 13, lineHeight: 1 }}>
                              {DELIVERY_EVENT_ICON[ev.type] || '📋'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <span
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: (DELIVERY_COLOR[ev.type] || '#888') + '22',
                                  color: DELIVERY_COLOR[ev.type] || '#888',
                                  textTransform: 'uppercase',
                                  marginRight: 8,
                                }}
                              >
                                {ev.type}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: 'var(--color-text-muted)',
                                    marginLeft: 8,
                                  }}
                                >
                                  {JSON.stringify(ev.metadata)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        fontWeight: 600,
                      }}
                    >
                      Rendered Email
                    </div>
                    <iframe
                      sandbox=""
                      srcDoc={entry.rendered_body_html}
                      style={{
                        width: '100%',
                        height: 300,
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        background: '#fff',
                      }}
                      title={`Rendered email — ${entry.id}`}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Unsubscribes panel ─────────────────────────────────────────── */}
      <div style={{ marginTop: 32, borderTop: '1px solid var(--color-border)', paddingTop: 24 }}>
        <div
          style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--color-text)' }}
        >
          Opt-out List (Unsubscribes)
        </div>
        <UnsubscribesPanel authHeaders={authHeaders} />
      </div>
    </div>
  )
}

// ─── Unsubscribes panel (embedded inside Send Log tab) ────────────────────────

interface UnsubscribeEntry {
  id: string
  email: string
  unsubscribed_at: string
  source: string
}

function UnsubscribesPanel({ authHeaders }: SectionProps) {
  const [entries, setEntries] = useState<UnsubscribeEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/outreach/unsubscribes?limit=200', {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load unsubscribes')
      const data = await res.json()
      setEntries(data.unsubscribes || [])
      setTotal(data.total || 0)
      setSelected(new Set())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function toggleSelect(email: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(email) ? next.delete(email) : next.add(email)
      return next
    })
  }

  function toggleAll() {
    setSelected(prev =>
      prev.size === entries.length ? new Set() : new Set(entries.map(e => e.email))
    )
  }

  async function handleRemove(email: string) {
    if (
      !confirm(
        `Remove ${email} from the suppression list? They will be eligible for outreach again.`
      )
    )
      return
    setRemoving(email)
    try {
      const res = await fetch(`/api/admin/outreach/unsubscribes/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Remove failed')
      setEntries(prev => prev.filter(e => e.email !== email))
      setTotal(t => Math.max(0, t - 1))
      setSelected(prev => {
        const n = new Set(prev)
        n.delete(email)
        return n
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(null)
    }
  }

  async function handleBulkRemove() {
    const emails = Array.from(selected)
    if (emails.length === 0) return
    if (
      !confirm(
        `Remove ${emails.length} email${emails.length !== 1 ? 's' : ''} from the suppression list? They will be eligible for outreach again.`
      )
    )
      return
    setBulkWorking(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/outreach/unsubscribes', {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Bulk remove failed')
      const { removed } = await res.json()
      setEntries(prev => prev.filter(e => !selected.has(e.email)))
      setTotal(t => Math.max(0, t - (removed ?? emails.length)))
      setSelected(new Set())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bulk remove failed')
    } finally {
      setBulkWorking(false)
    }
  }

  const SOURCE_LABEL: Record<string, string> = {
    email_link: 'Email link',
    admin: 'Admin',
    bounce: 'Bounce',
  }

  const bounceCount = entries.filter(e => e.source === 'bounce').length
  const optOutCount = entries.filter(e => e.source !== 'bounce').length
  const allSelected = entries.length > 0 && selected.size === entries.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {total > 0 ? (
            <>
              <strong style={{ color: 'var(--color-text)' }}>{total.toLocaleString()}</strong>{' '}
              suppressed
              {entries.length > 0 && (
                <>
                  {' '}
                  — <strong style={{ color: 'var(--color-text)' }}>{optOutCount}</strong> opt-out
                  {optOutCount !== 1 ? 's' : ''},{' '}
                  <strong style={{ color: 'var(--color-text)' }}>{bounceCount}</strong> bounce
                  {bounceCount !== 1 ? 's' : ''}
                  {total > 0 ? <> ({Math.round((bounceCount / total) * 100)}%)</> : null}
                </>
              )}
            </>
          ) : (
            'No opt-outs or bounces yet.'
          )}
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
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

      {/* Bulk action bar — visible when anything is selected */}
      {selected.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            background: 'rgba(226,114,42,0.08)',
            border: '1px solid var(--color-brand)',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-brand)', flex: 1 }}>
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkRemove}
            disabled={bulkWorking}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#3a1515',
              color: '#e05252',
              fontSize: 12,
              fontWeight: 700,
              cursor: bulkWorking ? 'not-allowed' : 'pointer',
              opacity: bulkWorking ? 0.6 : 1,
            }}
          >
            <Trash2 size={12} /> {bulkWorking ? 'Removing…' : `Remove ${selected.size}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
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
          No suppressed emails on record.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Select-all header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ cursor: 'pointer', width: 14, height: 14 }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {allSelected ? 'Deselect all' : `Select all ${entries.length}`}
            </span>
          </div>

          {entries.map(entry => (
            <div
              key={entry.id}
              style={{
                background: selected.has(entry.email)
                  ? 'rgba(226,114,42,0.06)'
                  : 'var(--color-surface)',
                border: selected.has(entry.email)
                  ? '1px solid rgba(226,114,42,0.4)'
                  : '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(entry.email)}
                onChange={() => toggleSelect(entry.email)}
                style={{ cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
                {entry.email}
              </span>
              {entry.source === 'bounce' ? (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#2a1800',
                    color: '#f5a623',
                    textTransform: 'uppercase',
                  }}
                >
                  bounced
                </span>
              ) : (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#2a1515',
                    color: '#e05252',
                    textTransform: 'uppercase',
                  }}
                >
                  opted out
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {SOURCE_LABEL[entry.source] || entry.source}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {new Date(entry.unsubscribed_at).toLocaleString()}
              </span>
              <button
                onClick={() => handleRemove(entry.email)}
                disabled={removing === entry.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--color-border)',
                  background: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: 11,
                  cursor: removing === entry.email ? 'not-allowed' : 'pointer',
                  opacity: removing === entry.email ? 0.5 : 1,
                }}
              >
                <Trash2 size={11} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

const PLACEHOLDER_ADDRESS = 'TraydBook · 8 The Green, Suite A · Dover, DE 19901'

function MailingAddressWarning() {
  const addr = import.meta.env.VITE_PHYSICAL_ADDRESS as string | undefined
  const isMissing = !addr || addr.trim() === ''
  const isPlaceholder = !isMissing && addr.trim() === PLACEHOLDER_ADDRESS
  if (!isMissing && !isPlaceholder) return null
  const message = isMissing
    ? 'VITE_PHYSICAL_ADDRESS is not set. Outreach email previews and live sends will use a fake placeholder address, violating CAN-SPAM. Set this env var to the real TraydBook mailing address.'
    : 'VITE_PHYSICAL_ADDRESS is still the placeholder (Dover, DE). Replace it with the real confirmed mailing address before sending outreach emails.'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        background: '#fff8e1',
        border: '1px solid #f9a825',
        borderRadius: 8,
        padding: '10px 14px',
        margin: '0 0 12px 0',
        fontSize: 13,
        color: '#7a5800',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
      <span>
        <strong>CAN-SPAM address warning:</strong> {message}
      </span>
    </div>
  )
}

export default function ProspectsSection({ authHeaders }: SectionProps) {
  const [tab, setTab] = useState<'prospects' | 'templates' | 'send-log'>('prospects')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <MailingAddressWarning />
      <TabBar active={tab} onChange={t => setTab(t as typeof tab)} />
      {tab === 'prospects' && <ProspectsTab authHeaders={authHeaders} />}
      {tab === 'templates' && <TemplatesTab authHeaders={authHeaders} />}
      {tab === 'send-log' && <SendLogTab authHeaders={authHeaders} />}
    </div>
  )
}
