import { useState, FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

const TRADES = [
  'Electrician', 'Plumber', 'HVAC Tech', 'Carpenter', 'Ironworker',
  'Mason / Bricklayer', 'Painter', 'Roofer', 'Welder', 'Pipefitter',
  'Sheet Metal Worker', 'Concrete / Flatwork', 'Drywall / Finisher',
  'Flooring', 'Tile Setter', 'Glazier', 'Insulation', 'Landscaping',
  'General Contractor', 'Construction Manager', 'Other',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

interface Step1 {
  email: string
  password: string
  confirmPassword: string
}

interface Step2 {
  displayName: string
  handle: string
  primaryTrade: string
  yearsExperience: string
  locationCity: string
  locationState: string
}

interface Step3 {
  businessName: string
  bio: string
  serviceRadius: string
}

interface ContractorLocationState {
  accountType?: AccountType
}

export default function SignupContractor() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as ContractorLocationState | null
  const accountType: AccountType = locationState?.accountType ?? 'contractor'

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [step1, setStep1] = useState<Step1>({ email: '', password: '', confirmPassword: '' })
  const [step2, setStep2] = useState<Step2>({
    displayName: '', handle: '', primaryTrade: '', yearsExperience: '',
    locationCity: '', locationState: '',
  })
  const [step3, setStep3] = useState<Step3>({ businessName: '', bio: '', serviceRadius: '50' })

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (step1.password !== step1.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (step1.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error, userId: uid } = await signUp(step1.email, step1.password)
    setLoading(false)
    if (error) { setError(error); return }
    if (uid) setUserId(uid)
    setStep(2)
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!step2.primaryTrade) { setError('Please select your primary trade.'); return }
    setStep(3)
  }

  async function handleStep3(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const uid = userId
      if (!uid) throw new Error('Session lost. Please start over.')

      const handle = step2.handle || slugify(step2.displayName) || `user${Date.now()}`

      const { error: profileError } = await supabase.from('users').insert({
        id: uid,
        email: step1.email,
        display_name: step2.displayName,
        handle,
        avatar_url: null,
        account_type: accountType,
        location_city: step2.locationCity || null,
        location_state: step2.locationState || null,
        location_zip: null,
        credit_balance: 0,
        deleted_at: null,
      })

      if (profileError) throw new Error(profileError.message)

      const { error: contractorError } = await supabase.from('contractor_profiles').insert({
        user_id: uid,
        business_name: step3.businessName || null,
        primary_trade: step2.primaryTrade,
        secondary_trades: [],
        years_experience: parseInt(step2.yearsExperience) || 0,
        bio: step3.bio || null,
        service_radius_miles: parseInt(step3.serviceRadius) || 50,
        availability_status: 'available',
        available_from: null,
        visible_to_owners: true,
        rating_avg: 0,
        rating_count: 0,
        projects_completed: 0,
        total_work_value: 0,
      })

      if (contractorError) throw new Error(contractorError.message)

      navigate('/feed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <Link to="/" className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 17 17" fill="none" width={16} height={16}>
              <rect x="2" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="1.2" />
              <rect x="5" y="1.5" width="9" height="13" rx="1.5" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.2" />
              <path d="M7 6h4M7 9h3M7 12h2" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="auth-logo-word"><span className="trayd">Trayd</span><span className="book">Book</span></div>
        </Link>

        <div className="signup-steps">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`signup-step ${s === step ? 'active' : s < step ? 'done' : ''}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Step 1 of 3 · Account credentials</p>
            <form onSubmit={handleStep1} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={step1.email}
                  onChange={e => setStep1(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={step1.password}
                  onChange={e => setStep1(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={step1.confirmPassword}
                  onChange={e => setStep1(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repeat password"
                  required
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
            <h1 className="auth-title">Your trade profile</h1>
            <p className="auth-subtitle">Step 2 of 3 · Professional info</p>
            <form onSubmit={handleStep2} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={step2.displayName}
                  onChange={e => setStep2(p => ({ ...p, displayName: e.target.value }))}
                  placeholder="Mike Rivera"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username (handle)</label>
                <input
                  type="text"
                  value={step2.handle}
                  onChange={e => setStep2(p => ({ ...p, handle: slugify(e.target.value) }))}
                  placeholder={`@${slugify(step2.displayName) || 'yourhandle'}`}
                />
              </div>
              <div className="form-group">
                <label>Primary Trade</label>
                <select
                  value={step2.primaryTrade}
                  onChange={e => setStep2(p => ({ ...p, primaryTrade: e.target.value }))}
                  required
                >
                  <option value="">Select your trade...</option>
                  {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  value={step2.yearsExperience}
                  onChange={e => setStep2(p => ({ ...p, yearsExperience: e.target.value }))}
                  placeholder="e.g. 12"
                  min="0"
                  max="60"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={step2.locationCity}
                    onChange={e => setStep2(p => ({ ...p, locationCity: e.target.value }))}
                    placeholder="Chicago"
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <select
                    value={step2.locationState}
                    onChange={e => setStep2(p => ({ ...p, locationState: e.target.value }))}
                  >
                    <option value="">State</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="step-nav">
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Continue</button>
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="auth-title">Almost done</h1>
            <p className="auth-subtitle">Step 3 of 3 · Business details</p>
            <form onSubmit={handleStep3} className="auth-form">
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label>Business Name (optional)</label>
                <input
                  type="text"
                  value={step3.businessName}
                  onChange={e => setStep3(p => ({ ...p, businessName: e.target.value }))}
                  placeholder="Rivera Electric LLC"
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea
                  value={step3.bio}
                  onChange={e => setStep3(p => ({ ...p, bio: e.target.value }))}
                  placeholder="Brief intro — trade specialty, years experience, what makes you stand out..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Service Radius (miles)</label>
                <select
                  value={step3.serviceRadius}
                  onChange={e => setStep3(p => ({ ...p, serviceRadius: e.target.value }))}
                >
                  {[10, 25, 50, 100, 250, 500].map(r => (
                    <option key={r} value={r}>{r} miles</option>
                  ))}
                </select>
              </div>
              <div className="step-nav">
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Setting up profile...' : 'Finish Setup'}
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
