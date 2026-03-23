import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, Lock, Bell, Eye, User, Trash2, CheckCircle,
  AlertTriangle, ChevronRight, Coins, ShieldCheck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { NotificationType } from '../lib/database.types'
import VerifiedBadge from '../components/VerifiedBadge'
import type { BadgeTier } from '../types/profile'

const NOTIF_LABELS: { type: NotificationType; label: string; description: string }[] = [
  { type: 'message_received',    label: 'New messages',            description: 'Someone sends you a message' },
  { type: 'connection_request',  label: 'Connection requests',     description: 'Someone wants to connect with you' },
  { type: 'connection_accepted', label: 'Connection accepted',     description: 'A connection request was accepted' },
  { type: 'bid_submitted',       label: 'Bid received',            description: 'A contractor bids on your RFQ' },
  { type: 'bid_awarded',         label: 'Bid awarded',             description: 'Your bid was selected' },
  { type: 'job_applied',         label: 'Job application',         description: 'Someone applies to your job listing' },
  { type: 'rfq_closing_soon',    label: 'RFQ closing soon',        description: 'A bid deadline is approaching' },
  { type: 'post_liked',          label: 'Post likes',              description: 'Someone likes your post' },
  { type: 'post_commented',      label: 'Post comments',           description: 'Someone comments on your post' },
  { type: 'credential_expiring', label: 'Credential expiring',     description: 'A license or cert is about to expire' },
  { type: 'credits_added',       label: 'Credits added',           description: 'Credits are added to your account' },
  { type: 'referral_received',   label: 'Referrals',               description: 'Someone refers you for work' },
  { type: 'safety_alert',        label: 'Safety alerts',           description: 'Safety-related alerts from your network' },
]

type NotifPrefs = Partial<Record<NotificationType, boolean>>

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
      }}>
        <span style={{ color: 'var(--color-brand)' }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700,
          letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text)',
        }}>
          {title}
        </span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function SavedBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.25)',
      borderRadius: 'var(--radius-sm)', padding: '8px 12px',
      color: '#059669', fontSize: 13, fontWeight: 600,
      fontFamily: 'var(--font-condensed)', marginTop: 10,
    }}>
      <CheckCircle size={14} /> {msg}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
      borderRadius: 'var(--radius-sm)', padding: '8px 12px',
      color: '#DC2626', fontSize: 13,
      marginTop: 10,
    }}>
      <AlertTriangle size={14} /> {msg}
    </div>
  )
}

export default function Settings() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const isContractor = profile?.account_type === 'contractor'

  // ── Email ──
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [sendingVerif, setSendingVerif] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  useEffect(() => {
    // Use the `user` from AuthContext (avoids extra network call)
    setCurrentEmail(user?.email ?? '')
  }, [user])

  async function handleResendVerification() {
    setSendingVerif(true)
    setEmailMsg('')
    setEmailErr('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: currentEmail })
    setSendingVerif(false)
    if (error) setEmailErr(error.message)
    else setEmailMsg('Verification email sent — check your inbox.')
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailMsg('')
    setEmailErr('')
    if (!newEmail || newEmail === currentEmail) { setEmailErr('Please enter a different email address.'); return }
    setChangingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setChangingEmail(false)
    if (error) {
      setEmailErr(error.message)
    } else {
      setEmailMsg(`Confirmation sent to ${newEmail}. Check your inbox and click the link to confirm the change.`)
      await refreshProfile()
      setNewEmail('')
    }
  }

  // ── Password ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg('')
    setPwdErr('')
    if (newPassword !== confirmPassword) { setPwdErr('Passwords do not match.'); return }
    if (newPassword.length < 8) { setPwdErr('Password must be at least 8 characters.'); return }
    setSavingPwd(true)
    // Re-authenticate first then update
    const signInRes = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    })
    if (signInRes.error) {
      setPwdErr('Current password is incorrect.')
      setSavingPwd(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPwd(false)
    if (error) setPwdErr(error.message)
    else {
      setPwdMsg('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  // ── Notifications ──
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({})
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSavedMsg, setNotifSavedMsg] = useState('')

  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_notification_prefs')
      .select('prefs')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.prefs) setNotifPrefs(data.prefs as NotifPrefs)
      })
  }, [profile])

  async function handleNotifToggle(type: NotificationType) {
    if (!profile || savingNotif) return
    const current = notifPrefs[type] !== false
    const updated = { ...notifPrefs, [type]: !current }
    setNotifPrefs(updated)
    setSavingNotif(true)
    setNotifSavedMsg('')
    const { error } = await supabase
      .from('user_notification_prefs')
      .upsert({ user_id: profile.id, prefs: updated, updated_at: new Date().toISOString() })
    setSavingNotif(false)
    if (error) {
      setNotifPrefs(notifPrefs)
      setNotifSavedMsg('Failed to save. Please try again.')
    } else {
      setNotifSavedMsg('Preferences saved.')
    }
    setTimeout(() => setNotifSavedMsg(''), 2500)
  }

  // ── Privacy (contractors only) ──
  const [visibleToOwners, setVisibleToOwners] = useState(true)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [privacyMsg, setPrivacyMsg] = useState('')

  useEffect(() => {
    if (!profile || !isContractor) return
    supabase
      .from('contractor_profiles')
      .select('visible_to_owners')
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => { if (data) setVisibleToOwners(data.visible_to_owners) })
  }, [profile, isContractor])

  async function handleVisibilityToggle() {
    if (!profile) return
    setSavingPrivacy(true)
    setPrivacyMsg('')
    const newVal = !visibleToOwners
    const { error } = await supabase
      .from('contractor_profiles')
      .update({ visible_to_owners: newVal })
      .eq('user_id', profile.id)
    setSavingPrivacy(false)
    if (!error) {
      setVisibleToOwners(newVal)
      setPrivacyMsg(newVal ? 'Your profile is now visible to owners.' : 'Your profile is now hidden from owners.')
    }
  }

  // ── Verification (contractors only) ──
  interface CredRow {
    id: string
    credential_type: string
    masked_display: string
    issuing_state: string | null
    expiry_date: string | null
    verified_at: string | null
    status: string
  }
  const [badgeTier, setBadgeTier] = useState<BadgeTier>(null)
  const [cpId, setCpId] = useState<string | null>(null)
  const [creds, setCreds] = useState<CredRow[]>([])
  const [credsLoading, setCredsLoading] = useState(false)
  const [credType, setCredType] = useState('license')
  const [credDisplay, setCredDisplay] = useState('')
  const [credState, setCredState] = useState('')
  const [credExpiry, setCredExpiry] = useState('')
  const [submittingCred, setSubmittingCred] = useState(false)
  const [credMsg, setCredMsg] = useState('')
  const [credErr, setCredErr] = useState('')

  useEffect(() => {
    if (!profile || !isContractor) return
    setCredsLoading(true)
    supabase
      .from('contractor_profiles')
      .select('id, badge_tier')
      .eq('user_id', profile.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setCpId(data.id)
          setBadgeTier(data.badge_tier as BadgeTier)
          supabase
            .from('credentials')
            .select('id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status')
            .eq('contractor_id', data.id)
            .order('created_at', { ascending: false })
            .then(({ data: cd }) => {
              setCreds((cd ?? []) as CredRow[])
              setCredsLoading(false)
            })
        } else {
          setCredsLoading(false)
        }
      })
  }, [profile, isContractor])

  async function handleSubmitCredential(e: React.FormEvent) {
    e.preventDefault()
    if (!cpId || !credDisplay.trim()) return
    setSubmittingCred(true)
    setCredMsg('')
    setCredErr('')
    const { error } = await supabase.from('credentials').insert({
      contractor_id: cpId,
      credential_type: credType,
      masked_display: credDisplay.trim(),
      issuing_state: credState || null,
      expiry_date: credExpiry || null,
      status: 'pending',
    })
    setSubmittingCred(false)
    if (error) {
      setCredErr('Failed to submit. ' + error.message)
    } else {
      setCredMsg('Submitted for review. We\'ll verify it within 2–3 business days.')
      setCredDisplay('')
      setCredState('')
      setCredExpiry('')
      // Reload
      const { data: cd } = await supabase
        .from('credentials')
        .select('id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status')
        .eq('contractor_id', cpId)
        .order('created_at', { ascending: false })
      setCreds((cd ?? []) as CredRow[])
    }
  }

  // ── Delete Account ──
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

  async function handleDeleteAccount() {
    if (!profile) return
    if (deleteConfirmText !== 'CONFIRM') { setDeleteErr('Type CONFIRM to proceed.'); return }
    setDeletingAccount(true)
    setDeleteErr('')
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (error) {
      setDeleteErr(error.message)
      setDeletingAccount(false)
      return
    }
    await signOut()
    navigate('/', { replace: true })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', color: 'var(--color-text)',
    fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none',
    boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '9px 18px', background: 'var(--color-brand)',
    border: 'none', borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.5px', textTransform: 'uppercase', color: '#fff',
    cursor: 'pointer',
  }

  const btnGhost: React.CSSProperties = {
    padding: '9px 18px', background: 'transparent',
    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--color-text-muted)',
    cursor: 'pointer',
  }

  return (
    <div className="container" style={{ padding: '32px 0', maxWidth: 680 }}>
      <h1 style={{
        fontFamily: 'var(--font-condensed)', fontSize: 26, fontWeight: 800,
        letterSpacing: '0.3px', color: 'var(--color-text)', marginBottom: 24,
      }}>
        Account Settings
      </h1>

      {/* Account type */}
      <SectionCard title="Account" icon={<User size={16} />}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Display name
            </div>
            <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              {profile?.display_name}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              Account type
            </div>
            <div style={{
              fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.5px', textTransform: 'uppercase',
              background: 'var(--color-brand-light)', color: 'var(--color-brand)',
              padding: '3px 10px', borderRadius: 4, display: 'inline-block',
            }}>
              {profile?.account_type?.replace('_', ' ')}
            </div>
          </div>
          {!isContractor && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Credit balance
              </div>
              <button onClick={() => navigate('/credits')} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--color-brand-light)', border: '1px solid rgba(232,93,4,0.2)',
                borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700,
                color: 'var(--color-brand)',
              }}>
                <Coins size={14} /> {profile?.credit_balance ?? 0} credits
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Email */}
      <SectionCard title="Email" icon={<Mail size={16} />}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Current email
          </div>
          <div style={{
            fontFamily: 'var(--font-condensed)', fontSize: 15, fontWeight: 600,
            color: 'var(--color-text)',
          }}>
            {currentEmail || '—'}
          </div>
        </div>

        {/* Change email with re-verification */}
        <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              New email address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Enter new email"
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={changingEmail || !newEmail} style={{ ...btnGhost, opacity: (changingEmail || !newEmail) ? 0.6 : 1 }}>
            {changingEmail ? 'Sending…' : 'Change Email'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          <button
            onClick={handleResendVerification}
            disabled={sendingVerif || !currentEmail}
            style={{ ...btnGhost, opacity: sendingVerif ? 0.6 : 1, fontSize: 12 }}
          >
            {sendingVerif ? 'Sending…' : 'Resend Verification Email'}
          </button>
        </div>
        {emailMsg && <SavedBanner msg={emailMsg} />}
        {emailErr && <ErrorBanner msg={emailErr} />}
      </SectionCard>

      {/* Password */}
      <SectionCard title="Password" icon={<Lock size={16} />}>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
              placeholder="Repeat new password"
            />
          </div>
          <div style={{ marginTop: 4 }}>
            <button type="submit" disabled={savingPwd} style={{ ...btnPrimary, opacity: savingPwd ? 0.6 : 1 }}>
              {savingPwd ? 'Saving…' : 'Update Password'}
            </button>
          </div>
          {pwdMsg && <SavedBanner msg={pwdMsg} />}
          {pwdErr && <ErrorBanner msg={pwdErr} />}
        </form>
      </SectionCard>

      {/* Notification preferences */}
      <SectionCard title="Notifications" icon={<Bell size={16} />}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Choose which notifications you receive. Preferences are saved to your account.</span>
            {notifSavedMsg && <span style={{ color: notifSavedMsg.startsWith('Failed') ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #22c55e)', fontSize: 12, fontWeight: 600 }}>{notifSavedMsg}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NOTIF_LABELS.map(({ type, label, description }) => {
            const enabled = notifPrefs[type] !== false
            return (
              <div key={type} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600,
                    color: 'var(--color-text)',
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {description}
                  </div>
                </div>
                <button
                  onClick={() => handleNotifToggle(type)}
                  disabled={savingNotif}
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: enabled ? 'var(--color-brand)' : 'var(--color-border)',
                    border: 'none', cursor: savingNotif ? 'not-allowed' : 'pointer',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    opacity: savingNotif ? 0.7 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: enabled ? 20 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Privacy (contractors only) */}
      {isContractor && (
        <SectionCard title="Privacy" icon={<Eye size={16} />}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg)',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600,
                color: 'var(--color-text)',
              }}>
                Show profile in Explore
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Allow project owners and agents to find your profile
              </div>
            </div>
            <button
              onClick={handleVisibilityToggle}
              disabled={savingPrivacy}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: visibleToOwners ? 'var(--color-brand)' : 'var(--color-border)',
                border: 'none', cursor: savingPrivacy ? 'not-allowed' : 'pointer',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                opacity: savingPrivacy ? 0.6 : 1,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: visibleToOwners ? 20 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          {privacyMsg && <SavedBanner msg={privacyMsg} />}
        </SectionCard>
      )}

      {/* Verification (contractors only) */}
      {isContractor && (
        <SectionCard title="Verification & Badges" icon={<ShieldCheck size={16} />}>
          {/* Badge status */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Your current verification badge
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {badgeTier ? (
                <>
                  <VerifiedBadge tier={badgeTier} size="lg" />
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {badgeTier === 'pro_verified' && 'Licensed + fully insured. Highest trust tier.'}
                    {badgeTier === 'licensed' && 'License verified. Add insurance for Pro Verified.'}
                    {badgeTier === 'vouched' && 'Endorsed by a Pro Verified contractor.'}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No badge yet. Submit credentials to get verified.
                </span>
              )}
            </div>
          </div>

          {/* Badge tier guide */}
          <div style={{
            background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
            padding: '14px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              How badges work
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { tier: 'pro_verified' as const, desc: 'License + General Liability + Workers\' Comp — all verified' },
                { tier: 'licensed' as const, desc: 'License verified. Insurance not yet on file.' },
                { tier: 'vouched' as const, desc: 'Vouched by a Pro Verified contractor in your network.' },
              ].map(({ tier, desc }) => (
                <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <VerifiedBadge tier={tier} size="sm" />
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Existing credentials */}
          {creds.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Submitted credentials
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {creds.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px', gap: 10,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                        {c.credential_type === 'license' ? 'License'
                          : c.credential_type === 'general_liability' ? 'General Liability Insurance'
                          : c.credential_type === 'workers_comp' ? 'Workers\' Comp Insurance'
                          : c.credential_type}
                        {c.issuing_state && ` — ${c.issuing_state}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{c.masked_display}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '2px 7px', flexShrink: 0,
                      ...(c.verified_at
                        ? { color: '#059669', background: 'rgba(5,150,105,0.1)' }
                        : c.status === 'pending'
                          ? { color: '#D97706', background: 'rgba(217,119,6,0.1)' }
                          : { color: '#DC2626', background: 'rgba(220,38,38,0.1)' }),
                    }}>
                      {c.verified_at ? '✓ Verified' : c.status === 'pending' ? 'Pending Review' : c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit new credential */}
          {badgeTier !== 'pro_verified' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Submit a credential
              </div>
              <form onSubmit={handleSubmitCredential} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                    Credential type
                  </label>
                  <select
                    value={credType}
                    onChange={e => setCredType(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="license">Contractor / Trade License</option>
                    <option value="general_liability">General Liability Insurance</option>
                    <option value="workers_comp">Workers&apos; Comp Insurance</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                    License / policy display (e.g. ending in 1234)
                  </label>
                  <input
                    type="text"
                    value={credDisplay}
                    onChange={e => setCredDisplay(e.target.value)}
                    placeholder="e.g. License #****-1234"
                    required
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Only masked info is stored publicly. Our team will verify via the issuing authority.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                      Issuing state (optional)
                    </label>
                    <input
                      type="text"
                      value={credState}
                      onChange={e => setCredState(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="TX"
                      maxLength={2}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                      Expiry date (optional)
                    </label>
                    <input
                      type="date"
                      value={credExpiry}
                      onChange={e => setCredExpiry(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <button type="submit" disabled={submittingCred || !credDisplay.trim()} style={{ ...btnPrimary, opacity: (submittingCred || !credDisplay.trim()) ? 0.6 : 1 }}>
                    {submittingCred ? 'Submitting…' : 'Submit for Verification'}
                  </button>
                </div>
                {credMsg && <SavedBanner msg={credMsg} />}
                {credErr && <ErrorBanner msg={credErr} />}
              </form>
            </div>
          )}

          {credsLoading && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Loading credentials…
            </div>
          )}
        </SectionCard>
      )}

      {/* Delete account */}
      <SectionCard title="Delete Account" icon={<Trash2 size={16} />}>
        <div style={{
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)',
          borderRadius: 'var(--radius-md)', padding: '16px',
        }}>
          <div style={{
            fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600,
            color: '#DC2626', marginBottom: 6,
          }}>
            Permanent action
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
            This will deactivate your account. Your data will be soft-deleted and you will be signed out.
            Type <strong style={{ color: 'var(--color-text)' }}>CONFIRM</strong> below to proceed.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type CONFIRM"
              style={{ ...inputStyle, maxWidth: 180, flex: '0 0 auto' }}
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== 'CONFIRM'}
              style={{
                padding: '9px 18px',
                background: deleteConfirmText === 'CONFIRM' ? '#DC2626' : 'var(--color-bg)',
                border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 700,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                color: deleteConfirmText === 'CONFIRM' ? '#fff' : '#DC2626',
                cursor: (deletingAccount || deleteConfirmText !== 'CONFIRM') ? 'not-allowed' : 'pointer',
                opacity: deletingAccount ? 0.6 : 1,
              }}
            >
              {deletingAccount ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
          {deleteErr && <ErrorBanner msg={deleteErr} />}
        </div>
      </SectionCard>
    </div>
  )
}
