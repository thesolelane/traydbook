import { useState } from 'react'
import { LogOut, AlertTriangle } from 'lucide-react'
import { SectionProps } from './shared'

type Scope = 'user' | 'ip' | 'all'

export default function SessionRevokeSection({ authHeaders }: SectionProps) {
  const [scope, setScope] = useState<Scope>('user')
  const [userId, setUserId] = useState('')
  const [ipPattern, setIpPattern] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ revoked: boolean; affected_sessions: number } | null>(null)
  const [err, setErr] = useState('')

  async function submit() {
    if (!reason || reason.length < 10) {
      setErr('Reason must be at least 10 characters')
      return
    }
    if (scope === 'user' && !userId) { setErr('User ID required'); return }
    if (scope === 'ip' && !ipPattern) { setErr('IP pattern required'); return }

    setLoading(true)
    setErr('')
    setResult(null)
    try {
      const res = await fetch('/api/admin/revoke/sessions', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, user_id: userId, ip_pattern: ipPattern, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.pending_approval) {
        setErr(data.message)
        return
      }
      setResult(data)
      setUserId('')
      setIpPattern('')
      setReason('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 540 }}>
      <div style={{ padding: 16, background: '#1a1a0a', border: '1px solid #e0b852', borderRadius: 8, display: 'flex', gap: 10, fontSize: 13, color: '#e0b852' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        This immediately logs out users. The <strong>All Sessions</strong> scope requires a second admin approval.
      </div>

      {/* Scope selector */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scope</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['user', 'ip', 'all'] as Scope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                border: scope === s ? '1px solid var(--color-brand)' : '1px solid var(--color-border)',
                background: scope === s ? 'rgba(226,114,42,0.15)' : 'var(--color-surface)',
                color: scope === s ? 'var(--color-brand)' : 'var(--color-text-muted)',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {s === 'all' ? 'All Sessions ⚠️' : s === 'user' ? 'By User' : 'By IP'}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      {scope === 'user' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>User ID</label>
          <input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="UUID of user"
            style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
      )}

      {scope === 'ip' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>IP Pattern</label>
          <input
            value={ipPattern}
            onChange={e => setIpPattern(e.target.value)}
            placeholder="e.g. 192.168.1.% or exact IP"
            style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
      )}

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Reason (min 10 chars)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Explain why you are revoking these sessions..."
          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', padding: '8px 12px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {err && (
        <div style={{ padding: 10, background: '#2a1515', border: '1px solid #e05252', borderRadius: 6, color: '#e05252', fontSize: 13 }}>{err}</div>
      )}

      {result && (
        <div style={{ padding: 12, background: '#1a3a25', border: '1px solid #52c97a', borderRadius: 8, color: '#52c97a', fontSize: 13 }}>
          ✓ Revoked {result.affected_sessions} session{result.affected_sessions !== 1 ? 's' : ''}
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: scope === 'all' ? '#e05252' : 'var(--color-brand)',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <LogOut size={15} />
        {loading ? 'Revoking...' : 'Revoke Sessions'}
      </button>
    </div>
  )
}
