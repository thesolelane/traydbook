import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCw, Mail, CheckCircle, XCircle, Clock, SkipForward, Plus, Eye, Pause, Play, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
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
  by_status: Record<string, number>
  by_type: Record<string, number>
}

interface Template {
  id: string
  name: string
  prospect_type: 'contractor' | 'real_estate_agent'
  subject: string
  body_html: string
  body_text: string | null
  status: 'draft' | 'approved' | 'paused'
  created_at: string
  updated_at: string
}

interface DeliveryEvent {
  type: string
  timestamp: string
  metadata?: Record<string, unknown>
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
  pending:  '#e0b852',
  enriched: 'var(--color-brand)',
  drafted:  '#7c70e8',
  sent:     '#52c97a',
  replied:  '#10B981',
  skipped:  '#888',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:  <Clock size={12} />,
  enriched: <Mail size={12} />,
  drafted:  <Mail size={12} />,
  sent:     <CheckCircle size={12} />,
  replied:  <CheckCircle size={12} />,
  skipped:  <SkipForward size={12} />,
}

const MERGE_TAGS = ['{{first_name}}', '{{trade}}', '{{city}}', '{{license_number}}', '{{state}}', '{{unsubscribe_url}}']

const TMPL_STATUS_COLOR: Record<string, string> = {
  draft:    '#e0b852',
  approved: '#52c97a',
  paused:   '#888',
}

const DELIVERY_COLOR: Record<string, string> = {
  sent:      '#52c97a',
  delivered: '#10B981',
  bounced:   '#e05252',
  failed:    '#e05252',
  opened:    '#7c70e8',
  clicked:   '#3b82f6',
}

const DELIVERY_EVENT_ICON: Record<string, string> = {
  sent:      '📤',
  delivered: '✅',
  bounced:   '🚫',
  failed:    '❌',
  opened:    '👁️',
  clicked:   '🖱️',
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
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
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
            borderBottom: active === t.id ? '2px solid var(--color-brand)' : '2px solid transparent',
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
  const [stats, setStats]             = useState<Stats | null>(null)
  const [prospects, setProspects]     = useState<Prospect[]>([])
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [err, setErr]                 = useState('')
  const [success, setSuccess]         = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter]   = useState('')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const fileRef                       = useRef<HTMLInputElement>(null)
  const [prospectType, setProspectType] = useState<'contractor' | 'real_estate_agent'>('contractor')

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/prospects/stats', { headers: authHeaders() })
    if (res.ok) setStats(await res.json())
  }, [])

  const loadProspects = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '50', status: statusFilter })
      if (typeFilter) params.set('prospect_type', typeFilter)
      const res = await fetch(`/api/admin/prospects?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load prospects')
      const data = await res.json()
      setProspects(data.prospects || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  useEffect(() => { void loadStats(); void loadProspects() }, [loadStats, loadProspects])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr('')
    setSuccess('')
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
      setSuccess(`✓ Imported ${data.imported} prospects (batch: ${data.batch_id})`)
      await loadStats()
      await loadProspects()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
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

  const statuses = ['pending', 'enriched', 'drafted', 'sent', 'replied', 'skipped']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: stats.total, color: 'var(--color-text)' },
            { label: 'Contractors', value: stats.by_type.contractor || 0, color: 'var(--color-brand)' },
            { label: 'RE Agents', value: stats.by_type.real_estate_agent || 0, color: '#7c70e8' },
            { label: 'Pending', value: stats.by_status.pending || 0, color: '#e0b852' },
            { label: 'Drafted', value: stats.by_status.drafted || 0, color: '#7c70e8' },
            { label: 'Sent', value: stats.by_status.sent || 0, color: '#52c97a' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '12px 18px',
              minWidth: 100,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  border: prospectType === t ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                  background: prospectType === t ? 'rgba(226,114,42,0.15)' : 'var(--color-bg)',
                  color: prospectType === t ? 'var(--color-brand)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                }}
              >
                {t === 'contractor' ? '🔨 Contractor' : '🏠 RE Agent'}
              </button>
            ))}
          </div>
          <label style={{
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
          }}>
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
            Max 10MB · Deduplicates by license number
          </span>
        </div>
        {success && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#1a3a25', border: '1px solid #52c97a', borderRadius: 6, color: '#52c97a', fontSize: 13 }}>
            {success}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border: statusFilter === s ? `1px solid ${STATUS_COLOR[s]}` : '1px solid var(--color-border)',
              background: statusFilter === s ? (STATUS_COLOR[s] + '22') : 'var(--color-surface)',
              color: statusFilter === s ? STATUS_COLOR[s] : 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {STATUS_ICON[s]} {s} {stats?.by_status[s] ? `(${stats.by_status[s]})` : ''}
          </button>
        ))}
        <button
          onClick={() => setTypeFilter(t => t === 'contractor' ? 'real_estate_agent' : t === 'real_estate_agent' ? '' : 'contractor')}
          style={{
            marginLeft: 8,
            padding: '5px 12px',
            borderRadius: 20,
            fontSize: 12,
            border: typeFilter ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
            background: typeFilter ? 'rgba(226,114,42,0.1)' : 'var(--color-surface)',
            color: typeFilter ? 'var(--color-brand)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          {typeFilter ? (typeFilter === 'contractor' ? '🔨 Contractors' : '🏠 RE Agents') : 'All Types'}
        </button>
        <button
          onClick={() => { void loadStats(); void loadProspects() }}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
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
        <div style={{ padding: 12, background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
      ) : prospects.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No {statusFilter} prospects{typeFilter ? ` (${typeFilter})` : ''}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prospects.map(p => (
            <div key={p.id} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: (STATUS_COLOR[p.status] || '#888') + '22',
                  color: STATUS_COLOR[p.status] || '#888',
                  textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {STATUS_ICON[p.status]} {p.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {p.first_name} {p.last_name}
                  {p.business_name && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> — {p.business_name}</span>}
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
                  <span style={{ fontSize: 10, color: '#7c70e8', marginLeft: p.email_found ? 8 : 'auto' }}>🏠 RE</span>
                )}
              </div>

              {expanded === p.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                    <div><strong>License:</strong> {p.license_number || '—'}</div>
                    <div><strong>Status:</strong> {p.status_description || '—'}</div>
                    <div><strong>Email:</strong> {p.email_found || 'Not found yet'}</div>
                    <div><strong>Batch:</strong> {p.import_batch}</div>
                    <div><strong>Imported:</strong> {new Date(p.created_at).toLocaleDateString()}</div>
                    {p.sent_at && <div><strong>Sent:</strong> {new Date(p.sent_at).toLocaleDateString()}</div>}
                  </div>

                  {p.email_body && (
                    <div style={{ background: 'var(--color-bg)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Email Draft
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{p.email_subject}</div>
                      <pre style={{ margin: 0, fontSize: 11, color: 'var(--color-text)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>
                        {p.email_body}
                      </pre>
                    </div>
                  )}

                  {p.status === 'drafted' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => markSent(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: '#1a3a25', color: '#52c97a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        <CheckCircle size={13} /> Mark Sent
                      </button>
                      <button
                        onClick={() => markSkipped(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
                          background: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        <XCircle size={13} /> Skip
                      </button>
                    </div>
                  )}

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
  const [name, setName]         = useState(initial?.name || '')
  const [type, setType]         = useState<'contractor' | 'real_estate_agent'>(initial?.prospect_type || 'contractor')
  const [subject, setSubject]   = useState(initial?.subject || '')
  const [bodyHtml, setBodyHtml] = useState(initial?.body_html || '')
  const [bodyText, setBodyText] = useState(initial?.body_text || '')
  const [preview, setPreview]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

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
          body: JSON.stringify({ name, prospect_type: type, subject, body_html: bodyHtml, body_text: bodyText }),
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

  const sampleProspect = { first_name: 'Alex', trade: 'General Contractor', city: 'Austin', license_number: 'GC-12345', state: 'TX' }
  function renderPreview(s: string) {
    return s
      .replace(/\{\{first_name\}\}/g, sampleProspect.first_name)
      .replace(/\{\{trade\}\}/g, sampleProspect.trade)
      .replace(/\{\{city\}\}/g, sampleProspect.city)
      .replace(/\{\{license_number\}\}/g, sampleProspect.license_number)
      .replace(/\{\{state\}\}/g, sampleProspect.state)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial?.id ? 'Edit Template' : 'New Template'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Template Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Contractor Welcome Outreach"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Prospect Type</label>
            <select value={type} onChange={e => setType(e.target.value as 'contractor' | 'real_estate_agent')} style={inputStyle}>
              <option value="contractor">🔨 Contractor</option>
              <option value="real_estate_agent">🏠 Real Estate Agent</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Subject Line</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. {{first_name}}, grow your business in {{city}}"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center', marginRight: 4 }}>Merge tags:</span>
          {MERGE_TAGS.map(tag => (
            <code key={tag} style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 4,
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              color: 'var(--color-brand)', cursor: 'pointer',
            }}
              title="Click to copy"
              onClick={() => navigator.clipboard?.writeText(tag)}
            >{tag}</code>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 4 }}>
          {['editor', 'preview'].map(m => (
            <button
              key={m}
              onClick={() => setPreview(m === 'preview')}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', border: 'none',
                background: 'none', cursor: 'pointer',
                color: (preview ? m === 'preview' : m === 'editor') ? 'var(--color-brand)' : 'var(--color-text-muted)',
                borderBottom: (preview ? m === 'preview' : m === 'editor') ? '2px solid var(--color-brand)' : '2px solid transparent',
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
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>HTML Body</label>
              <textarea
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                rows={10}
                placeholder="<p>Hi {{first_name}},</p>..."
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Plain Text Body <span style={{ fontWeight: 400 }}>(optional)</span></label>
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
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
              <strong>Subject:</strong> {renderPreview(subject) || <span style={{ color: 'var(--color-text-muted)' }}>(empty)</span>}
            </div>
            <iframe
              sandbox=""
              srcDoc={renderPreview(bodyHtml) || '<em style="color:#999">No HTML content yet.</em>'}
              style={{ width: '100%', height: 200, border: 'none', background: '#fff' }}
              title="Email preview"
            />
          </div>
        )}

        {err && (
          <div style={{ padding: '8px 12px', background: '#2a1515', border: '1px solid #e05252', borderRadius: 6, color: '#e05252', fontSize: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', borderRadius: 7, border: '1px solid var(--color-border)',
            background: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '8px 22px', borderRadius: 7, border: 'none',
            background: saving ? 'var(--color-surface-2)' : 'var(--color-brand)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────

function TemplatesTab({ authHeaders }: SectionProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [editing, setEditing]     = useState<Partial<Template> | null | false>(false)
  const [typeFilter, setTypeFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams()
      if (typeFilter) params.set('prospect_type', typeFilter)
      const res = await fetch(`/api/admin/outreach/templates?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: 'draft' | 'approved' | 'paused') {
    const res = await fetch(`/api/admin/outreach/templates/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) await load()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    const res = await fetch(`/api/admin/outreach/templates/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) await load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={() => setEditing({})}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> New Template
        </button>
        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          {(['', 'contractor', 'real_estate_agent'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: typeFilter === t ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: typeFilter === t ? 'rgba(226,114,42,0.1)' : 'var(--color-surface)',
                color: typeFilter === t ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer',
              }}
            >
              {t === '' ? 'All Types' : t === 'contractor' ? '🔨 Contractors' : '🏠 RE Agents'}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-muted)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <strong style={{ color: 'var(--color-text)' }}>How it works:</strong> Bob picks the latest <span style={{ color: '#52c97a' }}>approved</span> template matching a prospect's type, fills the merge tags, sends the email autonomously, and logs it to the Send Log — no per-email review needed. <span style={{ color: '#e0b852' }}>Draft</span> templates are ignored. Set to <span style={{ color: '#888' }}>paused</span> to kill-switch a template.
      </div>

      {err && (
        <div style={{ padding: 12, background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>{err}</div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No templates yet. Create one to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              background: 'var(--color-surface)',
              border: `1px solid ${t.status === 'approved' ? '#52c97a44' : 'var(--color-border)'}`,
              borderRadius: 10,
              padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: (TMPL_STATUS_COLOR[t.status] || '#888') + '22',
                  color: TMPL_STATUS_COLOR[t.status] || '#888',
                  textTransform: 'uppercase',
                }}>
                  {t.status}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{t.name}</span>
                <span style={{ fontSize: 11, color: '#7c70e8' }}>
                  {t.prospect_type === 'contractor' ? '🔨 Contractor' : '🏠 RE Agent'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                <strong>Subject:</strong> {t.subject}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setEditing(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px', borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <Eye size={12} /> Edit / Preview
                </button>
                {t.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus(t.id, 'approved')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 6, border: '1px solid #52c97a44',
                      background: '#1a3a2522', color: '#52c97a', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Play size={12} /> Approve
                  </button>
                )}
                {t.status === 'approved' && (
                  <button
                    onClick={() => updateStatus(t.id, 'paused')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 6, border: '1px solid #88888844',
                      background: 'none', color: '#888', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <Pause size={12} /> Pause
                  </button>
                )}
                {t.status === 'paused' && (
                  <button
                    onClick={() => updateStatus(t.id, 'draft')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 6, border: '1px solid #e0b85244',
                      background: 'none', color: '#e0b852', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Back to Draft
                  </button>
                )}
                <button
                  onClick={() => deleteTemplate(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
                    padding: '5px 12px', borderRadius: 6, border: '1px solid #e0525222',
                    background: 'none', color: '#e05252', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== false && (
        <TemplateEditor
          initial={editing}
          authHeaders={authHeaders}
          onClose={() => setEditing(false)}
          onSave={() => { setEditing(false); void load() }}
        />
      )}
    </div>
  )
}

// ─── Send Log tab ─────────────────────────────────────────────────────────────

function SendLogTab({ authHeaders }: SectionProps) {
  const [logs, setLogs]           = useState<SendLogEntry[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [err, setErr]             = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter) params.set('delivery_status', statusFilter)
      const res = await fetch(`/api/admin/outreach/send-log?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load send log')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { void load() }, [load])

  const deliveryStatuses = ['', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {deliveryStatuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: statusFilter === s ? `1px solid ${DELIVERY_COLOR[s] || 'var(--color-brand)'}` : '1px solid var(--color-border)',
              background: statusFilter === s ? ((DELIVERY_COLOR[s] || 'var(--color-brand)') + '22') : 'var(--color-surface)',
              color: statusFilter === s ? (DELIVERY_COLOR[s] || 'var(--color-brand)') : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}
          >
            {s || 'All'}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-muted)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {total > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {total.toLocaleString()} emails sent total
        </div>
      )}

      {err && (
        <div style={{ padding: 12, background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>{err}</div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading send log...</div>
      ) : logs.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No emails sent yet{statusFilter ? ` with status "${statusFilter}"` : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map(entry => (
            <div key={entry.id} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer', flexWrap: 'wrap',
                }}
              >
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: (DELIVERY_COLOR[entry.delivery_status] || '#888') + '22',
                  color: DELIVERY_COLOR[entry.delivery_status] || '#888',
                  textTransform: 'uppercase',
                }}>
                  {entry.delivery_status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {entry.prospect?.first_name} {entry.prospect?.last_name}
                  {entry.prospect?.business_name && (
                    <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> — {entry.prospect.business_name}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {entry.prospect?.email_found || '—'}
                </span>
                <span style={{ fontSize: 11, color: '#7c70e8', marginLeft: 4 }}>
                  via {entry.template?.name || 'Unknown template'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {new Date(entry.sent_at).toLocaleString()}
                  {expanded === entry.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </div>

              {expanded === entry.id && (
                <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Delivery Timeline
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {entry.delivery_events.map((ev, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 13, lineHeight: 1 }}>{DELIVERY_EVENT_ICON[ev.type] || '📋'}</span>
                            <div style={{ flex: 1 }}>
                              <span style={{
                                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                background: (DELIVERY_COLOR[ev.type] || '#888') + '22',
                                color: DELIVERY_COLOR[ev.type] || '#888',
                                textTransform: 'uppercase',
                                marginRight: 8,
                              }}>
                                {ev.type}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {new Date(ev.timestamp).toLocaleString()}
                              </span>
                              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 8 }}>
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
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                      Rendered Email
                    </div>
                    <iframe
                      sandbox=""
                      srcDoc={entry.rendered_body_html}
                      style={{
                        width: '100%', height: 300, border: '1px solid var(--color-border)',
                        borderRadius: 6, background: '#fff',
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
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--color-text)' }}>
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
  const [entries, setEntries]   = useState<UnsubscribeEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/admin/outreach/unsubscribes?limit=200', { headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load unsubscribes')
      const data = await res.json()
      setEntries(data.unsubscribes || [])
      setTotal(data.total || 0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleRemove(email: string) {
    if (!confirm(`Remove ${email} from the unsubscribe list? They will be eligible for outreach again.`)) return
    setRemoving(email)
    try {
      const res = await fetch(`/api/admin/outreach/unsubscribes/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Remove failed')
      }
      setEntries(prev => prev.filter(e => e.email !== email))
      setTotal(t => Math.max(0, t - 1))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoving(null)
    }
  }

  const SOURCE_LABEL: Record<string, string> = {
    email_link: 'Email link',
    admin:      'Admin',
    bounce:     'Bounce',
  }

  const bounceCount  = entries.filter(e => e.source === 'bounce').length
  const optOutCount  = entries.filter(e => e.source !== 'bounce').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {total > 0
            ? <>
                <strong style={{ color: 'var(--color-text)' }}>{total.toLocaleString()}</strong> suppressed
                {entries.length > 0 && (
                  <> — <strong style={{ color: 'var(--color-text)' }}>{optOutCount}</strong> opt-out{optOutCount !== 1 ? 's' : ''}, <strong style={{ color: 'var(--color-text)' }}>{bounceCount}</strong> bounce{bounceCount !== 1 ? 's' : ''}{total > 0 ? <> (<strong style={{ color: 'var(--color-text)' }}>{Math.round((bounceCount / total) * 100)}%</strong>)</> : null}</>
                )}
              </>
            : 'No opt-outs or bounces yet.'}
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 6, color: 'var(--color-text-muted)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {err && (
        <div style={{ padding: 12, background: '#2a1515', border: '1px solid #e05252', borderRadius: 8, color: '#e05252', fontSize: 13 }}>{err}</div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No unsubscribes on record.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map(entry => (
            <div key={entry.id} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
                {entry.email}
              </span>
              {entry.source === 'bounce' ? (
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: '#2a1800', color: '#f5a623', textTransform: 'uppercase',
                }}>
                  bounced
                </span>
              ) : (
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: '#2a1515', color: '#e05252', textTransform: 'uppercase',
                }}>
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
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 5,
                  border: '1px solid var(--color-border)',
                  background: 'none', color: 'var(--color-text-muted)',
                  fontSize: 11, cursor: removing === entry.email ? 'not-allowed' : 'pointer',
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

export default function ProspectsSection({ authHeaders }: SectionProps) {
  const [tab, setTab] = useState<'prospects' | 'templates' | 'send-log'>('prospects')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TabBar active={tab} onChange={t => setTab(t as typeof tab)} />
      {tab === 'prospects' && <ProspectsTab authHeaders={authHeaders} />}
      {tab === 'templates' && <TemplatesTab authHeaders={authHeaders} />}
      {tab === 'send-log'  && <SendLogTab authHeaders={authHeaders} />}
    </div>
  )
}
