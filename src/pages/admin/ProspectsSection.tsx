import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCw, Mail, CheckCircle, XCircle, Clock, SkipForward, Plus, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { SectionProps } from './shared'

// ── Types ────────────────────────────────────────────────────────────────────

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
  prospect_type: string
  subject: string
  body_text: string
  status: string
  created_at: string
  updated_at: string
}

interface SendLog {
  id: string
  prospect_id: string
  template_id: string | null
  rendered_subject: string | null
  rendered_body: string | null
  sent_at: string
  delivery_status: string
  bob_job_id: string | null
  notes: string | null
  outreach_prospects: {
    first_name: string
    last_name: string
    business_name: string
    email_found: string
    prospect_type: string
  } | null
  outreach_templates: {
    name: string
    prospect_type: string
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

const TEMPLATE_STATUS_COLOR: Record<string, string> = {
  draft:    '#e0b852',
  approved: '#52c97a',
  paused:   '#888',
}

const DELIVERY_COLOR: Record<string, string> = {
  sent:    '#52c97a',
  bounced: '#e0b852',
  failed:  '#e05252',
  pending: '#888',
}

const MERGE_TAGS = ['{{first_name}}', '{{last_name}}', '{{business_name}}', '{{license_number}}', '{{type_class}}', '{{city}}', '{{state}}']

// ── Sub-components ────────────────────────────────────────────────────────────

function ProspectsTab({ authHeaders }: SectionProps) {
  const [stats, setStats]           = useState<Stats | null>(null)
  const [prospects, setProspects]   = useState<Prospect[]>([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [err, setErr]               = useState('')
  const [success, setSuccess]       = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const fileRef                     = useRef<HTMLInputElement>(null)
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
            { label: 'Total',       value: stats.total,                        color: 'var(--color-text)' },
            { label: 'Contractors', value: stats.by_type.contractor || 0,      color: 'var(--color-brand)' },
            { label: 'RE Agents',   value: stats.by_type.real_estate_agent||0, color: '#7c70e8' },
            { label: 'Pending',     value: stats.by_status.pending || 0,       color: '#e0b852' },
            { label: 'Drafted',     value: stats.by_status.drafted || 0,       color: '#7c70e8' },
            { label: 'Sent',        value: stats.by_status.sent || 0,          color: '#52c97a' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 18px', minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={15} color="var(--color-brand)" /> Import CSV
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['contractor', 'real_estate_agent'] as const).map(t => (
              <button key={t} onClick={() => setProspectType(t)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: prospectType === t ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: prospectType === t ? 'rgba(226,114,42,0.15)' : 'var(--color-bg)',
                color: prospectType === t ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer',
              }}>
                {t === 'contractor' ? '🔨 Contractor' : '🏠 RE Agent'}
              </button>
            ))}
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 8,
            background: uploading ? 'var(--color-surface-2)' : 'var(--color-brand)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1,
          }}>
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Choose CSV'}
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} disabled={uploading} onChange={handleUpload} />
          </label>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Max 10MB · Deduplicates by license number</span>
        </div>
        {success && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#1a3a25', border: '1px solid #52c97a', borderRadius: 6, color: '#52c97a', fontSize: 13 }}>
            {success}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: statusFilter === s ? `1px solid ${STATUS_COLOR[s]}` : '1px solid var(--color-border)',
            background: statusFilter === s ? (STATUS_COLOR[s] + '22') : 'var(--color-surface)',
            color: statusFilter === s ? STATUS_COLOR[s] : 'var(--color-text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {STATUS_ICON[s]} {s} {stats?.by_status[s] ? `(${stats.by_status[s]})` : ''}
          </button>
        ))}
        <button onClick={() => setTypeFilter(t => t === 'contractor' ? 'real_estate_agent' : t === 'real_estate_agent' ? '' : 'contractor')} style={{
          marginLeft: 8, padding: '5px 12px', borderRadius: 20, fontSize: 12,
          border: typeFilter ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
          background: typeFilter ? 'rgba(226,114,42,0.1)' : 'var(--color-surface)',
          color: typeFilter ? 'var(--color-brand)' : 'var(--color-text-muted)', cursor: 'pointer',
        }}>
          {typeFilter ? (typeFilter === 'contractor' ? '🔨 Contractors' : '🏠 RE Agents') : 'All Types'}
        </button>
        <button onClick={() => { void loadStats(); void loadProspects() }} style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 6, color: 'var(--color-text-muted)', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
        }}>
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
            <div key={p.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(expanded === p.id ? null : p.id)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: (STATUS_COLOR[p.status] || '#888') + '22', color: STATUS_COLOR[p.status] || '#888', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {STATUS_ICON[p.status]} {p.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {p.first_name} {p.last_name}
                  {p.business_name && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}> — {p.business_name}</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.city}, {p.state}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.type_class}</span>
                {p.email_found && <span style={{ fontSize: 11, color: '#52c97a', marginLeft: 'auto' }}>✓ {p.email_found}</span>}
                {p.prospect_type === 'real_estate_agent' && <span style={{ fontSize: 10, color: '#7c70e8', marginLeft: p.email_found ? 8 : 'auto' }}>🏠 RE</span>}
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
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Draft</div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{p.email_subject}</div>
                      <pre style={{ margin: 0, fontSize: 11, color: 'var(--color-text)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.6 }}>{p.email_body}</pre>
                    </div>
                  )}
                  {p.status === 'drafted' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => markSent(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1a3a25', color: '#52c97a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        <CheckCircle size={13} /> Mark Sent
                      </button>
                      <button onClick={() => markSkipped(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', fontSize: 12, cursor: 'pointer' }}>
                        <XCircle size={13} /> Skip
                      </button>
                    </div>
                  )}
                  {p.status === 'pending' && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Waiting for Bob to enrich and draft an email.</div>
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

// ── Templates Tab ─────────────────────────────────────────────────────────────

const BLANK_FORM = { name: '', prospect_type: 'contractor', subject: '', body_text: '', status: 'draft' }

function TemplatesTab({ authHeaders }: SectionProps) {
  const [templates, setTemplates]   = useState<Template[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<Template | null>(null)
  const [creating, setCreating]     = useState(false)
  const [form, setForm]             = useState(BLANK_FORM)
  const [saving, setSaving]         = useState(false)
  const [err, setErr]               = useState('')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [preview, setPreview]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/prospects/templates', { headers: authHeaders() })
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(BLANK_FORM)
    setCreating(true)
    setErr('')
    setPreview(false)
  }

  function openEdit(t: Template) {
    setCreating(false)
    setEditing(t)
    setForm({ name: t.name, prospect_type: t.prospect_type, subject: t.subject, body_text: t.body_text, status: t.status })
    setErr('')
    setPreview(false)
  }

  function cancelForm() {
    setCreating(false)
    setEditing(null)
    setForm(BLANK_FORM)
  }

  async function save() {
    setSaving(true)
    setErr('')
    try {
      const method = editing ? 'PATCH' : 'POST'
      const url = editing ? `/api/admin/prospects/templates/${editing.id}` : '/api/admin/prospects/templates'
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      cancelForm()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/admin/prospects/templates/${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await fetch(`/api/admin/prospects/templates/${id}`, { method: 'DELETE', headers: authHeaders() })
    await load()
  }

  function renderPreview(body: string) {
    return body
      .replace(/\{\{first_name\}\}/g, 'Jane')
      .replace(/\{\{last_name\}\}/g, 'Smith')
      .replace(/\{\{business_name\}\}/g, 'Smith Contracting LLC')
      .replace(/\{\{license_number\}\}/g, 'LIC-123456')
      .replace(/\{\{type_class\}\}/g, 'General Contractor')
      .replace(/\{\{city\}\}/g, 'Austin')
      .replace(/\{\{state\}\}/g, 'TX')
  }

  const showForm = creating || !!editing

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Create and approve templates. Bob picks the approved template matching the prospect type, fills in merge tags, and sends.
        </div>
        {!showForm && (
          <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> New Template
          </button>
        )}
      </div>

      {/* Merge tag reference */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Merge Tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MERGE_TAGS.map(tag => (
            <code key={tag} style={{ fontSize: 11, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 7px', color: 'var(--color-brand)', cursor: 'pointer', userSelect: 'all' }}>
              {tag}
            </code>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
          If a value is missing, Bob substitutes a sensible fallback (e.g. full name when business_name is empty).
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-brand)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--color-brand)' }}>
            {editing ? `Edit — ${editing.name}` : 'New Template'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Template Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Contractor Cold Outreach v1"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Prospect Type</label>
              <select
                value={form.prospect_type}
                onChange={e => setForm(f => ({ ...f, prospect_type: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13 }}
              >
                <option value="contractor">🔨 Contractor</option>
                <option value="real_estate_agent">🏠 Real Estate Agent</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13 }}
              >
                <option value="draft">Draft — Bob ignores</option>
                <option value="approved">Approved — Bob sends</option>
                <option value="paused">Paused — kill switch</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Subject Line</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Grow Your Business with TraydBook — {{first_name}}"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Email Body</label>
              <button onClick={() => setPreview(p => !p)} style={{ fontSize: 11, color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 14, fontSize: 13, lineHeight: 1.7, color: 'var(--color-text)', whiteSpace: 'pre-wrap', minHeight: 200 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Subject: {renderPreview(form.subject)}
                </div>
                {renderPreview(form.body_text)}
              </div>
            ) : (
              <textarea
                value={form.body_text}
                onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))}
                placeholder="Hi {{first_name}},&#10;&#10;I came across your {{type_class}} license..."
                rows={12}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'var(--font-mono, monospace)', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }}
              />
            )}
          </div>

          {err && <div style={{ padding: '8px 12px', background: '#2a1515', border: '1px solid #e05252', borderRadius: 6, color: '#e05252', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: 'var(--color-brand)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
            </button>
            <button onClick={cancelForm} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading templates…</div>
      ) : templates.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No templates yet. Create one above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: (TEMPLATE_STATUS_COLOR[t.status] || '#888') + '22', color: TEMPLATE_STATUS_COLOR[t.status] || '#888', textTransform: 'uppercase' }}>
                  {t.status}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {t.prospect_type === 'contractor' ? '🔨' : '🏠'} {t.prospect_type === 'contractor' ? 'Contractor' : 'RE Agent'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </span>

                {/* Actions */}
                {t.status !== 'approved' && (
                  <button onClick={() => setStatus(t.id, 'approved')} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #52c97a', background: 'rgba(82,201,122,0.08)', color: '#52c97a', cursor: 'pointer' }}>
                    Approve
                  </button>
                )}
                {t.status === 'approved' && (
                  <button onClick={() => setStatus(t.id, 'paused')} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: '1px solid #888', background: 'rgba(136,136,136,0.08)', color: '#888', cursor: 'pointer' }}>
                    Pause
                  </button>
                )}
                {t.status === 'paused' && (
                  <button onClick={() => setStatus(t.id, 'draft')} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    Draft
                  </button>
                )}

                <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <Edit2 size={13} />
                </button>
                <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e05252', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={13} />
                </button>
                <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                  {expanded === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {expanded === t.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Subject</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Body</div>
                  <pre style={{ margin: 0, fontSize: 12, color: 'var(--color-text)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.7, background: 'var(--color-bg)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                    {t.body_text}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Send Log Tab ──────────────────────────────────────────────────────────────

function SendLogTab({ authHeaders }: SectionProps) {
  const [logs, setLogs]       = useState<SendLog[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/prospects/send-log?limit=50', { headers: authHeaders() })
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {total} total sends logged
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
          No sends logged yet. Bob will write here after each send.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.map(log => {
            const p = log.outreach_prospects
            const name = p ? `${p.first_name} ${p.last_name}${p.business_name ? ` — ${p.business_name}` : ''}` : log.prospect_id
            const templateName = log.outreach_templates?.name || '—'
            return (
              <div key={log.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: (DELIVERY_COLOR[log.delivery_status] || '#888') + '22', color: DELIVERY_COLOR[log.delivery_status] || '#888', textTransform: 'uppercase' }}>
                    {log.delivery_status}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p?.email_found}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    via <strong>{templateName}</strong>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {new Date(log.sent_at).toLocaleString()}
                  </span>
                  <button onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                    {expanded === log.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
                {expanded === log.id && (
                  <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                    {log.rendered_subject && (
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Subject: {log.rendered_subject}</div>
                    )}
                    {log.rendered_body && (
                      <pre style={{ margin: 0, fontSize: 12, color: 'var(--color-text)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.7, background: 'var(--color-bg)', padding: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}>
                        {log.rendered_body}
                      </pre>
                    )}
                    {log.bob_job_id && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>Bob job: {log.bob_job_id}</div>
                    )}
                    {log.notes && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>{log.notes}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

type SubTab = 'prospects' | 'templates' | 'send-log'

export default function ProspectsSection({ authHeaders }: SectionProps) {
  const [subTab, setSubTab] = useState<SubTab>('prospects')

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'prospects', label: 'Prospects' },
    { id: 'templates', label: 'Templates' },
    { id: 'send-log',  label: 'Send Log' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderBottom: subTab === t.id ? '2px solid var(--color-brand)' : '2px solid transparent',
              background: 'none',
              color: subTab === t.id ? 'var(--color-brand)' : 'var(--color-text-muted)',
              fontWeight: subTab === t.id ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'prospects' && <ProspectsTab authHeaders={authHeaders} />}
      {subTab === 'templates' && <TemplatesTab authHeaders={authHeaders} />}
      {subTab === 'send-log'  && <SendLogTab  authHeaders={authHeaders} />}
    </div>
  )
}
