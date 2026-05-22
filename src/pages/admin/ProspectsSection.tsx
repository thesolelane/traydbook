import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCw, Users, Mail, CheckCircle, XCircle, Clock, SkipForward } from 'lucide-react'
import { SectionProps } from './shared'

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

export default function ProspectsSection({ authHeaders }: SectionProps) {
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

      {/* Stats row */}
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

      {/* Upload panel */}
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

      {/* Filters */}
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

      {/* Prospect list */}
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
