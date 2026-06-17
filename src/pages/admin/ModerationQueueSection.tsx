import { useState, useEffect, useCallback } from 'react'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { SectionProps } from './shared'

interface ModerationItem {
  id: string
  content_type: string
  content_id: string
  content_table: string
  status: string
  decision: string | null
  admin_notes: string | null
  created_at: string
  resolved_at: string | null
}

export default function ModerationQueueSection({ authHeaders }: SectionProps) {
  const [items, setItems] = useState<ModerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('pending')
  const [resolving, setResolving] = useState<string | null>(null)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/moderation/queue?status=${filter}`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load queue')
      const data = await res.json()
      setItems(data.items || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRealtime(['content_moderation_queue'], load)

  async function resolve(id: string, decision: 'approve' | 'reject' | 'escalate') {
    setResolving(id)
    try {
      const res = await fetch(`/api/admin/moderation/${id}/resolve`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, admin_notes: noteMap[id] || '' }),
      })
      if (!res.ok) throw new Error('Failed to resolve')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to resolve')
    } finally {
      setResolving(null)
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    pending: '#e0b852',
    in_review: 'var(--color-brand)',
    resolved: '#52c97a',
    escalated: '#e05252',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {['pending', 'in_review', 'resolved', 'escalated'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              border:
                filter === s ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
              background: filter === s ? 'rgba(226,114,42,0.15)' : 'var(--color-surface)',
              color: filter === s ? 'var(--color-brand)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
        <button
          onClick={() => void load()}
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
      ) : items.length === 0 ? (
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 13,
            textAlign: 'center',
            padding: 40,
          }}
        >
          No {filter.replace('_', ' ')} items
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    background: (STATUS_COLOR[item.status] || '#888') + '22',
                    color: STATUS_COLOR[item.status] || '#888',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.status}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                  {item.content_type}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {item.content_id}
                </span>
                <span
                  style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}
                >
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              {item.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    placeholder="Admin notes..."
                    value={noteMap[item.id] || ''}
                    onChange={e => setNoteMap(m => ({ ...m, [item.id]: e.target.value }))}
                    style={{
                      flex: 1,
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 6,
                      color: 'var(--color-text)',
                      padding: '6px 10px',
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={() => resolve(item.id, 'approve')}
                    disabled={resolving === item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#1a3a25',
                      color: '#52c97a',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button
                    onClick={() => resolve(item.id, 'reject')}
                    disabled={resolving === item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2a1515',
                      color: '#e05252',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <XCircle size={13} /> Reject
                  </button>
                  <button
                    onClick={() => resolve(item.id, 'escalate')}
                    disabled={resolving === item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2a1a0a',
                      color: '#e07c52',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <AlertTriangle size={13} /> Escalate
                  </button>
                </div>
              )}

              {item.decision && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                  Decision: <strong style={{ color: 'var(--color-text)' }}>{item.decision}</strong>
                  {item.admin_notes && <> — {item.admin_notes}</>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
