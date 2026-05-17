import { useState, useEffect } from 'react'
import { Shield, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Props {
  onLogin: () => void
}

function parseHashParams() {
  const hash = window.location.hash.slice(1)
  return Object.fromEntries(new URLSearchParams(hash))
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)

  useEffect(() => {
    const params = parseHashParams()
    if (params.type === 'recovery' && params.access_token) {
      supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token ?? '',
      })
      window.history.replaceState(null, '', window.location.pathname)
      setMode('reset')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw new Error(signInErr.message)
      if (!data.session) throw new Error('No session returned')
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })
      if (res.status === 403) {
        await supabase.auth.signOut()
        throw new Error('Access denied — admin account required')
      }
      if (!res.ok) throw new Error('Could not verify admin access')
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      })
      if (err) throw new Error(err.message)
      setForgotSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword })
      if (err) throw new Error(err.message)
      setResetDone(true)
      setTimeout(() => {
        setMode('login')
        setResetDone(false)
        setNewPassword('')
        setConfirmPassword('')
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    color: 'var(--color-text)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  }

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '12px',
    background: disabled ? 'var(--color-border)' : 'var(--color-brand)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.5px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
    width: '100%',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ width: 360, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {mode === 'reset'
            ? <KeyRound size={32} color="var(--color-brand)" style={{ margin: '0 auto 12px' }} />
            : <Shield size={32} color="var(--color-brand)" style={{ margin: '0 auto 12px' }} />
          }
          <h1 style={{ fontFamily: 'var(--font-condensed)', fontWeight: 900, fontSize: 24, letterSpacing: '1px' }}>
            {mode === 'reset' ? 'SET NEW PASSWORD' : 'TRAYDBOOK ADMIN'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {mode === 'login' && 'Super Admin Access Only'}
            {mode === 'forgot' && 'Enter your admin email'}
            {mode === 'reset' && 'Choose a new password'}
          </p>
        </div>

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={inputStyle} />
            </div>
            {error && <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#ef4444' }}>{error}</div>}
            <button type="submit" disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
            <button type="button" onClick={() => { setMode('forgot'); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Forgot password?
            </button>
          </form>
        )}

        {/* ── FORGOT ── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {forgotSent ? (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '12px', fontSize: 13, color: '#10B981', textAlign: 'center' }}>
                Recovery email sent — check your inbox and click the link.
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>Admin Email</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
                </div>
                {error && <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#ef4444' }}>{error}</div>}
                <button type="submit" disabled={loading} style={btnStyle(loading)}>
                  {loading ? 'Sending...' : 'Send Recovery Email'}
                </button>
              </>
            )}
            <button type="button" onClick={() => { setMode('login'); setError(''); setForgotSent(false) }} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Back to sign in
            </button>
          </form>
        )}

        {/* ── RESET ── */}
        {mode === 'reset' && (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {resetDone ? (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '12px', fontSize: 13, color: '#10B981', textAlign: 'center' }}>
                Password updated — redirecting to sign in…
              </div>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={inputStyle} />
                </div>
                {error && <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#ef4444' }}>{error}</div>}
                <button type="submit" disabled={loading} style={btnStyle(loading)}>
                  {loading ? 'Updating...' : 'Set New Password'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
