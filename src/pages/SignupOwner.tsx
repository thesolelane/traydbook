import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  contractor: 'Contractor',
  project_owner: 'Project Owner',
  agent: 'Real Estate Agent',
  homeowner: 'Homeowner',
  admin: 'Admin',
}

const CREDIT_INFO: Record<string, string> = {
  project_owner: 'Post RFQs (10 credits), job listings (8 credits), and message contractors (3 credits). Start with a free credit pack.',
  agent: 'Post referrals (5 credits) and message contractors (3 credits).',
  homeowner: 'Post service requests (5 credits) and message contractors (3 credits).',
}

export default function SignupOwner() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const accountType = (location.state as any)?.accountType as AccountType || 'project_owner'

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const { error, userId: uid } = await signUp(email, password)
    setLoading(false)
    if (error) { setError(error); return }
    if (uid) setUserId(uid)
    setStep(2)
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const uid = userId
      if (!uid) throw new Error('Session lost. Please start over.')

      const h = handle || slugify(displayName) || `user${Date.now()}`

      const { error: profileError } = await supabase.from('users').insert({
        id: uid,
        email,
        display_name: displayName,
        handle: h,
        avatar_url: null,
        account_type: accountType,
        location_city: locationCity || null,
        location_state: locationState || null,
        location_zip: null,
        credit_balance: 50,
        deleted_at: null,
      })

      if (profileError) throw new Error(profileError.message)

      await supabase.from('credit_ledger').insert({
        user_id: uid,
        delta: 50,
        balance_after: 50,
        transaction_type: 'purchase',
        description: 'Welcome credits',
      })

      navigate('/feed')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <Link to="/" className="auth-logo">
          <span className="auth-logo-mark">T</span>
          <span>traydbook</span>
        </Link>

        <div className="signup-steps">
          {[1, 2].map(s => (
            <div
              key={s}
              className={`signup-step ${s === step ? 'active' : s < step ? 'done' : ''}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Step 1 of 2 · Account credentials</p>
            <div style={{
              background: 'rgba(232, 93, 38, 0.08)',
              border: '1px solid rgba(232, 93, 38, 0.2)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', marginBottom: 4 }}>
                {ACCOUNT_TYPE_LABELS[accountType]} · Credit-based access
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {CREDIT_INFO[accountType] || ''}
                {' '}You'll receive <strong style={{ color: 'var(--color-text)' }}>50 welcome credits</strong> free.
              </div>
            </div>
            <form onSubmit={handleStep1} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" required minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password" required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title">Your profile</h1>
            <p className="auth-subtitle">Step 2 of 2 · Basic info</p>
            <form onSubmit={handleStep2} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text" value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Jane Smith" required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text" value={handle}
                  onChange={e => setHandle(slugify(e.target.value))}
                  placeholder={`@${slugify(displayName) || 'yourhandle'}`}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text" value={locationCity}
                    onChange={e => setLocationCity(e.target.value)}
                    placeholder="Denver"
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <select value={locationState} onChange={e => setLocationState(e.target.value)}>
                    <option value="">State</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="step-nav">
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Creating profile...' : 'Finish Setup'}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="auth-footer-text" style={{ marginTop: 20 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
