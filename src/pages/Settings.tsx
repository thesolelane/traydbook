import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Mail, Lock, Bell, Eye, User, Trash2, CheckCircle,
  AlertTriangle, ShieldCheck, CreditCard, Coins, Zap,
  TrendingUp, Award, Star, CheckCircle as CheckCircleIcon,
  XCircle,
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

const BUNDLES = [
  { id: 'starter',      name: 'Starter',      credits: 25,  price: '$9',  perCredit: '$0.36 / cr', icon: Zap,        popular: false },
  { id: 'builder',      name: 'Builder',      credits: 75,  price: '$24', perCredit: '$0.32 / cr', icon: TrendingUp, popular: true  },
  { id: 'professional', name: 'Professional', credits: 200, price: '$54', perCredit: '$0.27 / cr', icon: Award,      popular: false },
  { id: 'power',        name: 'Power',        credits: 500, price: '$99', perCredit: '$0.20 / cr', icon: Star,       popular: false },
]

const CREDIT_COSTS = [
  { action: 'Post an RFQ',            cost: 10 },
  { action: 'Post a job listing',     cost: 8  },
  { action: 'Cold-message a contractor', cost: 3 },
]

interface LedgerRow {
  id: string
  delta: number
  balance_after: number
  transaction_type: string
  description: string
  created_at: string
}

type Tab = 'account' | 'notifications' | 'privacy' | 'billing' | 'verification' | 'danger'

interface TabDef {
  id: Tab
  label: string
  icon: React.ReactNode
  contractorOnly?: boolean
  ownerOnly?: boolean
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

export default function Settings() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isContractor = profile?.account_type === 'contractor'

  const rawTab = searchParams.get('tab') as Tab | null
  const [activeTab, setActiveTab] = useState<Tab>(rawTab ?? 'account')

  useEffect(() => {
    const t = searchParams.get('tab') as Tab | null
    if (t) setActiveTab(t)
  }, [searchParams])

  function goTab(tab: Tab) {
    setActiveTab(tab)
    setSearchParams({ tab }, { replace: true })
  }

  const TABS: TabDef[] = [
    { id: 'account',       label: 'Account',       icon: <User size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'privacy',       label: 'Privacy',        icon: <Eye size={15} />, contractorOnly: true },
    { id: 'billing',       label: 'Billing',        icon: <CreditCard size={15} />, ownerOnly: true },
    { id: 'verification',  label: 'Verification',   icon: <ShieldCheck size={15} />, contractorOnly: true },
    { id: 'danger',        label: 'Danger Zone',    icon: <Trash2 size={15} /> },
  ]

  const visibleTabs = TABS.filter(t => {
    if (t.contractorOnly && !isContractor) return false
    if (t.ownerOnly && isContractor) return false
    return true
  })

  // ── Email ──
  const [emailMsg, setEmailMsg] = useState('')
  const [emailErr, setEmailErr] = useState('')
  const [sendingVerif, setSendingVerif] = useState(false)
  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)

  useEffect(() => {
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
    const signInRes = await supabase.auth.signInWithPassword({ email: currentEmail, password: currentPassword })
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

  // ── Privacy ──
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

  // ── Verification ──
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
      const { data: cd } = await supabase
        .from('credentials')
        .select('id, credential_type, masked_display, issuing_state, expiry_date, verified_at, status')
        .eq('contractor_id', cpId)
        .order('created_at', { ascending: false })
      setCreds((cd ?? []) as CredRow[])
    }
  }

  // ── Billing (owner only) ──
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [billingBanner, setBillingBanner] = useState<'success' | 'canceled' | null>(null)
  const [buyError, setBuyError] = useState('')

  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    const sessionId = searchParams.get('session_id')

    if (canceled === 'true') {
      setBillingBanner('canceled')
      setSearchParams({ tab: 'billing' }, { replace: true })
      return
    }

    if (success !== 'true' || !sessionId) return

    setBillingBanner('success')
    setSearchParams({ tab: 'billing' }, { replace: true })

    async function pollUntilFulfilled() {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) { refreshProfile(); return }

      const maxAttempts = 15
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch(`/api/session-status?session_id=${sessionId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!res.ok) continue
          const { status } = await res.json()
          if (status === 'completed') {
            await refreshProfile()
            return
          }
        } catch (err) {
          console.warn('[billing] Session status poll error:', err)
        }
      }
      await refreshProfile()
    }

    pollUntilFulfilled()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile || isContractor) return
    supabase
      .from('credit_ledger')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLedger((data ?? []) as LedgerRow[]))
  }, [profile, isContractor])

  async function handleBuy(bundleId: string) {
    if (!profile) return
    setBuyError('')
    setBuying(bundleId)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const token = authSession?.access_token
      if (!token) throw new Error('Not authenticated. Please sign in again.')

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bundleId }),
      })
      const { url, error } = await res.json()
      if (!res.ok || !url) throw new Error(error ?? 'Failed to create checkout session')
      if (!url.startsWith('https://checkout.stripe.com/')) throw new Error('Invalid checkout URL')
      window.location.href = url
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBuying(null)
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

  return (
    <div className="container" style={{ padding: '32px 0', maxWidth: 900 }}>
      <h1 style={{
        fontFamily: 'var(--font-condensed)', fontSize: 26, fontWeight: 800,
        letterSpacing: '0.3px', color: 'var(--color-text)', marginBottom: 24,
      }}>
        Account Settings
      </h1>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        {/* ── Sidebar / Tab Strip ── */}
        <style>{`
          @media (max-width: 640px) {
            .settings-layout { flex-direction: column !important; }
            .settings-sidebar {
              width: 100% !important;
              flex-shrink: 0;
              border-right: none !important;
              border-bottom: 1px solid var(--color-border);
              flex-direction: row !important;
              overflow-x: auto;
              padding: 0 !important;
              gap: 0 !important;
            }
            .settings-tab {
              flex-direction: column !important;
              padding: 10px 14px !important;
              border-radius: 0 !important;
              white-space: nowrap;
              flex-shrink: 0;
              font-size: 11px !important;
              gap: 4px !important;
            }
            .settings-tab-label { display: block; }
            .settings-content { min-width: 0; width: 100% !important; padding: 20px 0 !important; }
          }
        `}</style>

        <div className="settings-layout" style={{ display: 'flex', width: '100%', gap: 0, alignItems: 'flex-start' }}>
          <nav
            className="settings-sidebar"
            style={{
              width: 200, flexShrink: 0,
              borderRight: '1px solid var(--color-border)',
              paddingRight: 0, display: 'flex', flexDirection: 'column', gap: 2,
              paddingTop: 4,
            }}
          >
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  className="settings-tab"
                  onClick={() => goTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '10px 16px',
                    background: isActive ? 'var(--color-brand-light)' : 'transparent',
                    border: 'none',
                    borderRight: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
                    borderRadius: 0,
                    color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.3px', cursor: 'pointer', textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {tab.icon}
                  <span className="settings-tab-label">{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* ── Content Panel ── */}
          <div
            className="settings-content"
            style={{ flex: 1, paddingLeft: 32, paddingTop: 4, minWidth: 0 }}
          >
            {/* ── ACCOUNT TAB ── */}
            {activeTab === 'account' && (
              <div>
                <TabHeading>Account</TabHeading>

                {/* Profile summary */}
                <Section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Display name</div>
                      <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
                        {profile?.display_name}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Account type</div>
                      <div style={{
                        fontFamily: 'var(--font-condensed)', fontSize: 12, fontWeight: 700,
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                        background: 'var(--color-brand-light)', color: 'var(--color-brand)',
                        padding: '3px 10px', borderRadius: 4, display: 'inline-block',
                      }}>
                        {profile?.account_type?.replace('_', ' ')}
                      </div>
                    </div>
                    {!isContractor && (
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Credit balance</div>
                        <button onClick={() => goTab('billing')} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'var(--color-brand-light)', border: '1px solid rgba(232,93,4,0.2)',
                          borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                          fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700,
                          color: 'var(--color-brand)',
                        }}>
                          <Coins size={14} /> {profile?.credit_balance ?? 0} credits
                        </button>
                      </div>
                    )}
                  </div>
                </Section>

                {/* Change email */}
                <SectionHeading>Email</SectionHeading>
                <Section>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Current email</div>
                    <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>
                      {currentEmail || '—'}
                    </div>
                  </div>
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
                    <div>
                      <button type="submit" disabled={changingEmail || !newEmail} style={{ ...btnGhost, opacity: (changingEmail || !newEmail) ? 0.6 : 1 }}>
                        {changingEmail ? 'Sending…' : 'Change Email'}
                      </button>
                    </div>
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
                </Section>

                {/* Change password */}
                <SectionHeading>Password</SectionHeading>
                <Section>
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
                    <div>
                      <button type="submit" disabled={savingPwd} style={{ ...btnPrimary, opacity: savingPwd ? 0.6 : 1 }}>
                        {savingPwd ? 'Saving…' : 'Update Password'}
                      </button>
                    </div>
                    {pwdMsg && <SavedBanner msg={pwdMsg} />}
                    {pwdErr && <ErrorBanner msg={pwdErr} />}
                  </form>
                </Section>
              </div>
            )}

            {/* ── NOTIFICATIONS TAB ── */}
            {activeTab === 'notifications' && (
              <div>
                <TabHeading>Notifications</TabHeading>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                  Choose which notifications you receive. Changes are saved automatically.
                  {notifSavedMsg && (
                    <span style={{
                      marginLeft: 12, fontWeight: 600,
                      color: notifSavedMsg.startsWith('Failed') ? '#ef4444' : '#22c55e',
                    }}>
                      {notifSavedMsg}
                    </span>
                  )}
                </div>
                <Section>
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
                            <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                              {label}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{description}</div>
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
                </Section>
              </div>
            )}

            {/* ── PRIVACY TAB (contractors only) ── */}
            {activeTab === 'privacy' && isContractor && (
              <div>
                <TabHeading>Privacy</TabHeading>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                  Control who can find you and contact you on the platform.
                </div>
                <Section>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg)',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
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
                </Section>
              </div>
            )}

            {/* ── BILLING TAB (owners only) ── */}
            {activeTab === 'billing' && !isContractor && (
              <div>
                <TabHeading>Billing & Credits</TabHeading>

                {/* Banners */}
                {billingBanner === 'success' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24,
                    color: '#059669',
                  }}>
                    <CheckCircleIcon size={18} />
                    <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: 15 }}>
                      Payment successful — credits added to your account!
                    </span>
                  </div>
                )}
                {billingBanner === 'canceled' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24,
                    color: '#DC2626',
                  }}>
                    <XCircle size={18} />
                    <span style={{ fontFamily: 'var(--font-condensed)', fontWeight: 600, fontSize: 15 }}>
                      Checkout canceled — no charges were made.
                    </span>
                  </div>
                )}

                {/* Balance */}
                <div style={{
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 20,
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-condensed)', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      color: 'var(--color-text-muted)', marginBottom: 8,
                    }}>
                      Current Balance
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <Coins size={26} color="var(--color-brand)" style={{ verticalAlign: 'middle', alignSelf: 'center' }} />
                      <span style={{
                        fontFamily: 'var(--font-condensed)', fontSize: 48, fontWeight: 800,
                        lineHeight: 1, color: 'var(--color-text)',
                      }}>
                        {profile?.credit_balance ?? 0}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-condensed)', fontSize: 16,
                        color: 'var(--color-text-muted)', alignSelf: 'flex-end', paddingBottom: 4,
                      }}>
                        credits
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-condensed)', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                      color: 'var(--color-text-muted)', marginBottom: 8,
                    }}>
                      What credits buy
                    </div>
                    {CREDIT_COSTS.map(c => (
                      <div key={c.action} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{c.action}</span>
                        <span style={{
                          fontFamily: 'var(--font-condensed)', fontSize: 13, fontWeight: 700,
                          color: 'var(--color-brand)',
                          background: 'var(--color-brand-light)', borderRadius: 4, padding: '1px 6px',
                        }}>
                          {c.cost} cr
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buy bundles */}
                <SectionHeading>Buy Credits</SectionHeading>
                {buyError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                    borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 16,
                    color: '#DC2626', fontSize: 13,
                  }}>
                    <XCircle size={15} /> {buyError}
                  </div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 14, marginBottom: 36,
                }}>
                  {BUNDLES.map(bundle => {
                    const Icon = bundle.icon
                    return (
                      <div key={bundle.id} style={{
                        background: 'var(--color-surface)',
                        border: bundle.popular ? '2px solid var(--color-brand)' : '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-lg)', padding: '22px 16px',
                        position: 'relative',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                      }}>
                        {bundle.popular && (
                          <div style={{
                            position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--color-brand)', color: '#fff',
                            fontFamily: 'var(--font-condensed)', fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.8px', textTransform: 'uppercase',
                            padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap',
                          }}>
                            Most Popular
                          </div>
                        )}
                        <Icon size={22} color="var(--color-brand)" style={{ marginBottom: 8 }} />
                        <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 4 }}>
                          {bundle.name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 30, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, marginBottom: 2 }}>
                          {bundle.credits}
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 2 }}>cr</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 12 }}>{bundle.perCredit}</div>
                        <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 22, fontWeight: 800, color: 'var(--color-text)', marginBottom: 12 }}>
                          {bundle.price}
                        </div>
                        <button
                          onClick={() => handleBuy(bundle.id)}
                          disabled={buying !== null}
                          style={{
                            width: '100%', padding: '8px 0',
                            background: bundle.popular ? 'var(--color-brand)' : 'transparent',
                            border: `1px solid var(--color-brand)`,
                            borderRadius: 'var(--radius-md)',
                            fontFamily: 'var(--font-condensed)', fontSize: 12, fontWeight: 700,
                            letterSpacing: '0.5px', textTransform: 'uppercase',
                            color: bundle.popular ? '#fff' : 'var(--color-brand)',
                            cursor: buying ? 'not-allowed' : 'pointer',
                            opacity: buying === bundle.id ? 0.6 : 1,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {buying === bundle.id ? 'Loading…' : 'Buy Now'}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Ledger */}
                <SectionHeading>Recent Activity</SectionHeading>
                {ledger.length === 0 ? (
                  <div style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: '24px',
                    textAlign: 'center', color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-condensed)', fontSize: 14,
                  }}>
                    No credit activity yet.
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  }}>
                    {ledger.map((row, i) => (
                      <div key={row.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: i < ledger.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                            {row.description}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {new Date(row.created_at).toLocaleString([], {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: 'var(--font-condensed)', fontSize: 16, fontWeight: 700,
                            color: row.delta > 0 ? '#059669' : '#DC2626',
                          }}>
                            {row.delta > 0 ? '+' : ''}{row.delta}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                            Balance: {row.balance_after}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── VERIFICATION TAB (contractors only) ── */}
            {activeTab === 'verification' && isContractor && (
              <div>
                <TabHeading>Verification & Badges</TabHeading>

                {/* Badge status */}
                <Section>
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
                </Section>

                {/* How badges work */}
                <SectionHeading>How badges work</SectionHeading>
                <Section>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                </Section>

                {/* Submitted credentials */}
                {credsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                    Loading credentials…
                  </div>
                ) : creds.length > 0 && (
                  <>
                    <SectionHeading>Submitted credentials</SectionHeading>
                    <Section>
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
                    </Section>
                  </>
                )}

                {/* Submit credential */}
                {badgeTier !== 'pro_verified' && (
                  <>
                    <SectionHeading>Submit a credential</SectionHeading>
                    <Section>
                      <form onSubmit={handleSubmitCredential} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                            Credential type
                          </label>
                          <select value={credType} onChange={e => setCredType(e.target.value)} style={inputStyle}>
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
                          <button
                            type="submit"
                            disabled={submittingCred || !credDisplay.trim()}
                            style={{ ...btnPrimary, opacity: (submittingCred || !credDisplay.trim()) ? 0.6 : 1 }}
                          >
                            {submittingCred ? 'Submitting…' : 'Submit for Verification'}
                          </button>
                        </div>
                        {credMsg && <SavedBanner msg={credMsg} />}
                        {credErr && <ErrorBanner msg={credErr} />}
                      </form>
                    </Section>
                  </>
                )}
              </div>
            )}

            {/* ── DANGER ZONE TAB ── */}
            {activeTab === 'danger' && (
              <div>
                <TabHeading>Danger Zone</TabHeading>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                  Destructive account actions. These cannot be undone.
                </div>
                <div style={{
                  background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 'var(--radius-md)', padding: '20px',
                }}>
                  <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700, color: '#DC2626', marginBottom: 6 }}>
                    Delete Account
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-condensed)', fontSize: 20, fontWeight: 800,
      letterSpacing: '0.2px', color: 'var(--color-text)', marginBottom: 20, marginTop: 0,
    }}>
      {children}
    </h2>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-condensed)', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.7px', textTransform: 'uppercase',
      color: 'var(--color-text-muted)', marginBottom: 10, marginTop: 24,
    }}>
      {children}
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px',
    }}>
      {children}
    </div>
  )
}
