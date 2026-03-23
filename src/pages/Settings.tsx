import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, Lock, Bell, Eye, User, Trash2, CheckCircle,
  AlertTriangle, ChevronRight, Coins,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { NotificationType } from '../lib/database.types'

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

function getNotifPrefs(userId: string): NotifPrefs {
  try {
    const raw = localStorage.getItem(`notif_prefs_${userId}`)
    if (raw) return JSON.parse(raw) as NotifPrefs
  } catch {}
  return {}
}

function saveNotifPrefs(userId: string, prefs: NotifPrefs) {
  localStorage.setItem(`notif_prefs_${userId}`, JSON.stringify(prefs))
}

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user?.email ?? '')
    })
  }, [])

  async function handleResendVerification() {
    setSendingVerif(true)
    setEmailMsg('')
    setEmailErr('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: currentEmail })
    setSendingVerif(false)
    if (error) setEmailErr(error.message)
    else setEmailMsg('Verification email sent — check your inbox.')
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

  useEffect(() => {
    if (profile) setNotifPrefs(getNotifPrefs(profile.id))
  }, [profile])

  function handleNotifToggle(type: NotificationType) {
    if (!profile) return
    const current = notifPrefs[type] !== false // default true
    const updated = { ...notifPrefs, [type]: !current }
    setNotifPrefs(updated)
    saveNotifPrefs(profile.id, updated)
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
        <button
          onClick={handleResendVerification}
          disabled={sendingVerif || !currentEmail}
          style={{ ...btnGhost, opacity: sendingVerif ? 0.6 : 1 }}
        >
          {sendingVerif ? 'Sending…' : 'Resend Verification Email'}
        </button>
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
          Choose which notifications you receive. Preferences are saved per device.
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
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: enabled ? 'var(--color-brand)' : 'var(--color-border)',
                    border: 'none', cursor: 'pointer', position: 'relative',
                    transition: 'background 0.2s', flexShrink: 0,
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
