import { useState, useRef, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'
import '../styles/auth.css'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

const TRADES = [
  'Electrician',
  'Plumber',
  'HVAC Tech',
  'Carpenter',
  'Ironworker',
  'Mason / Bricklayer',
  'Painter',
  'Roofer',
  'Welder',
  'Pipefitter',
  'Sheet Metal Worker',
  'Concrete / Flatwork',
  'Drywall / Finisher',
  'Flooring',
  'Tile Setter',
  'Glazier',
  'Insulation',
  'Landscaping',
  'General Contractor',
  'Construction Manager',
  'Other',
]

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
]

const ACCOUNT_TYPES: {
  type: AccountType
  icon: string
  title: string
  desc: string
  free?: boolean
}[] = [
  {
    type: 'contractor',
    icon: '🏗️',
    title: 'Contractor / Tradesperson',
    desc: 'Electricians, plumbers, HVAC, carpenters, and all skilled trades.',
    free: true,
  },
  {
    type: 'project_owner',
    icon: '📋',
    title: 'Project Owner',
    desc: 'Developers, investors, and commercial clients posting RFQs.',
  },
  {
    type: 'real_estate_agent',
    icon: '🏠',
    title: 'Real Estate Agent',
    desc: 'Agents connecting trades with their clients and projects.',
  },
  {
    type: 'homeowner',
    icon: '🔑',
    title: 'Homeowner',
    desc: 'Homeowners looking for trusted trade professionals.',
  },
]

type Step = 'account-type' | 'details' | 'contractor-details'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const meta = user?.user_metadata ?? {}
  const suggestedName: string = meta.full_name ?? meta.name ?? ''

  const [step, setStep] = useState<Step>('account-type')
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  const [displayName, setDisplayName] = useState(suggestedName)
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [trade, setTrade] = useState(TRADES[0])

  // Contractor-only extra fields
  const [businessName, setBusinessName] = useState('')
  const [yearsExperience, setYearsExperience] = useState('')
  const [serviceRadius, setServiceRadius] = useState('50')
  const [bio, setBio] = useState('')

  // Avatar upload
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_AVATAR_SIZE = 5 * 1024 * 1024

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')
    if (!file.type.startsWith('image/')) {
      setAvatarError('Invalid file type — please upload an image (JPG, PNG, GIF, etc).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('File too large — max 5 MB.')
      e.target.value = ''
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function uploadAvatar(uid: string): Promise<{ url: string; path: string } | null> {
    if (!avatarFile) return null
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `${uid}.${ext}`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return { url: data.publicUrl, path }
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleTypeSelect() {
    if (!accountType) return
    setStep('details')
  }

  function handleDetailsNext(e: FormEvent) {
    e.preventDefault()
    const trimName = displayName.trim()
    if (!trimName) { setError('Please enter your name.'); return }
    setError('')
    if (accountType === 'contractor') {
      setStep('contractor-details')
    } else {
      handleSubmitFinal()
    }
  }

  async function handleSubmitFinal() {
    if (!user || !accountType) return

    const trimName = displayName.trim()
    if (!trimName) return setError('Please enter your name.')

    setSubmitting(true)
    setError('')

    let uploadedAvatarPath: string | null = null
    // Set to true only after the server has persisted the row (including avatar_url).
    // Used to guard against deleting a correctly-saved avatar if a post-success
    // client-side step (refreshProfile / navigate) throws.
    let onboardingPersisted = false

    try {
      const avatarResult = await uploadAvatar(user.id)
      const avatarUrl = avatarResult?.url ?? null
      uploadedAvatarPath = avatarResult?.path ?? null

      const headers = await getAuthHeaders()
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          display_name: trimName,
          account_type: accountType,
          location_city: city.trim() || null,
          location_state: state || null,
          trade,
          business_name: businessName.trim() || null,
          years_experience: yearsExperience ? parseInt(yearsExperience) : null,
          service_radius_miles: serviceRadius ? parseInt(serviceRadius) : null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      // Profile row (including avatar_url) is now committed — do not clean up
      // the avatar file even if a subsequent client-side step throws.
      onboardingPersisted = true

      await refreshProfile()
      navigate('/feed', { replace: true })
    } catch (err) {
      // Only delete the orphaned avatar if the server never persisted the row.
      // If onboardingPersisted is true the DB already holds the avatar_url, so
      // removing the file would break the saved profile photo.
      if (uploadedAvatarPath && !onboardingPersisted) {
        supabase.storage.from('avatars').remove([uploadedAvatarPath]).catch(() => {})
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await handleSubmitFinal()
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: step === 'account-type' ? 520 : 440 }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg viewBox="0 0 17 17" fill="none" width={16} height={16}>
              <rect
                x="2"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.12)"
                stroke="white"
                strokeWidth="1.2"
              />
              <rect
                x="5"
                y="1.5"
                width="9"
                height="13"
                rx="1.5"
                fill="rgba(255,255,255,0.25)"
                stroke="white"
                strokeWidth="1.2"
              />
              <path
                d="M7 6h4M7 9h3M7 12h2"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="auth-logo-word">
            <span className="trayd">Trayd</span>
            <span className="book">Book</span>
          </div>
        </div>

        {step === 'account-type' ? (
          <>
            <h1 className="auth-title">Welcome to TraydBook</h1>
            <p className="auth-subtitle">How will you be using the platform?</p>

            <div className="account-type-grid">
              {ACCOUNT_TYPES.map(at => (
                <button
                  key={at.type}
                  className={`account-type-card ${accountType === at.type ? 'selected' : ''}`}
                  onClick={() => setAccountType(at.type)}
                >
                  <div className="atc-icon">{at.icon}</div>
                  <div className="atc-title">{at.title}</div>
                  <div className="atc-desc">{at.desc}</div>
                  {at.free && <div className="atc-badge">Always Free</div>}
                  {!at.free && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
                      Credit-based access
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              className="btn-primary btn-full"
              style={{ marginTop: 20 }}
              disabled={!accountType}
              onClick={handleTypeSelect}
            >
              Continue
            </button>
          </>
        ) : step === 'details' ? (
          <>
            <h1 className="auth-title">One last step</h1>
            <p className="auth-subtitle">
              {accountType === 'contractor'
                ? 'Step 1 of 2 · Confirm your details.'
                : 'Confirm your details to finish setting up.'}
            </p>

            <form
              onSubmit={handleDetailsNext}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div className="form-group">
                <label className="form-label">Your Name or Business Name</label>
                <input
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Full name or business name"
                  required
                />
              </div>

              {accountType === 'contractor' && (
                <div className="form-group">
                  <label className="form-label">Primary Trade</label>
                  <select
                    className="form-select"
                    value={trade}
                    onChange={e => setTrade(e.target.value)}
                  >
                    {TRADES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">City (optional)</label>
                  <input
                    className="form-input"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Dallas"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    className="form-select"
                    value={state}
                    onChange={e => setState(e.target.value)}
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setStep('account-type')}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2 }}
                  disabled={submitting}
                >
                  {accountType === 'contractor' ? 'Continue' : submitting ? 'Setting up…' : 'Finish Setup'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1 className="auth-title">Complete your profile</h1>
            <p className="auth-subtitle">Step 2 of 2 · Trade details (optional — you can update these later)</p>

            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div className="form-group">
                <label className="form-label">Profile Photo (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--color-surface-2)',
                      border: '1.5px solid var(--color-border)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                    }}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      '📷'
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAvatarChange}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: 13, padding: '6px 14px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {avatarPreview ? 'Change photo' : 'Upload photo'}
                    </button>
                    {avatarError && (
                      <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>
                        {avatarError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input
                  className="form-input"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="e.g. Rivera Electric LLC"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input
                    className="form-input"
                    type="number"
                    value={yearsExperience}
                    onChange={e => setYearsExperience(e.target.value)}
                    placeholder="e.g. 12"
                    min="0"
                    max="60"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Radius (miles)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={serviceRadius}
                    onChange={e => setServiceRadius(e.target.value)}
                    placeholder="50"
                    min="1"
                    max="500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bio</label>
                <textarea
                  className="form-input"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Briefly describe your experience and specialties…"
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setStep('details')}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 2 }}
                  disabled={submitting}
                >
                  {submitting ? 'Setting up…' : 'Finish Setup'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
