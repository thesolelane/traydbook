import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserCheck, X, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Keyed per user so clearing for one user doesn't affect another
const SEEN_KEY = (uid: string) => `profile_completion_banner_seen_${uid}`

/** Returns true when the Supabase user authenticated via an OAuth provider (not email/password). */
function isOAuthUser(user: ReturnType<typeof useAuth>['user']): boolean {
  if (!user) return false
  const provider = user.app_metadata?.provider as string | undefined
  return !!provider && provider !== 'email'
}

export default function ProfileCompletionBanner() {
  const { profile, user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!profile?.id || profile.account_type !== 'contractor') return
    if (!isOAuthUser(user)) return

    // Already shown on a previous visit — never show again
    if (localStorage.getItem(SEEN_KEY(profile.id))) return

    void (async () => {
      const { data } = await supabase
        .from('contractor_profiles')
        .select('bio, years_experience, business_name')
        .eq('user_id', profile.id)
        .single()

      if (!data) return

      const cp = data as {
        bio: string | null
        years_experience: number | null
        business_name: string | null
      }

      const missingBio = !cp.bio?.trim()
      const missingExperience = !cp.years_experience || cp.years_experience === 0
      const missingBusinessName = !cp.business_name?.trim()

      // Show when at least two of the three key profile fields are absent
      const isIncomplete =
        (missingBio ? 1 : 0) + (missingExperience ? 1 : 0) + (missingBusinessName ? 1 : 0) >= 2

      if (isIncomplete) {
        // Mark as seen immediately so it never re-appears on future visits
        localStorage.setItem(SEEN_KEY(profile.id), '1')
        setVisible(true)
      }
    })()
  }, [profile?.id, profile?.account_type, user])

  function dismiss() {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      setExiting(false)
    }, 250)
  }

  if (!visible || !profile) return null

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, rgba(226,114,42,0.10) 0%, rgba(226,114,42,0.03) 100%)',
        border: '1px solid rgba(226,114,42,0.30)',
        borderLeft: '3px solid var(--color-brand)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
      }}
    >
      <UserCheck
        size={20}
        color="var(--color-brand)"
        style={{ flexShrink: 0, marginTop: 1 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-condensed)',
            fontWeight: 800,
            fontSize: 15,
            color: 'var(--color-text)',
            letterSpacing: '0.2px',
            marginBottom: 3,
          }}
        >
          Finish setting up your profile
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            margin: '0 0 10px',
            lineHeight: 1.5,
          }}
        >
          Adding a bio, your years of experience, and business name helps owners find and trust you
          — it takes less than two minutes.
        </p>

        <Link
          to="/profile/edit"
          className="btn btn-primary"
          onClick={dismiss}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Complete your profile <ArrowRight size={12} />
        </Link>
      </div>

      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 2,
          color: 'var(--color-text-muted)',
          flexShrink: 0,
          lineHeight: 1,
        }}
        title="Dismiss"
        aria-label="Dismiss profile completion banner"
      >
        <X size={15} />
      </button>
    </div>
  )
}
