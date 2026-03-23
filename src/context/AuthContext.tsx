import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User, Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AccountType } from '../lib/database.types'

interface UserProfile {
  id: string
  display_name: string
  handle: string
  avatar_url: string | null
  account_type: AccountType
  credit_balance: number
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  needsOnboarding: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; userId?: string; needsEmailConfirmation?: boolean }>
  signInWithOAuth: (provider: Provider) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  async function fetchProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await supabase
      .from('users')
      .select('id, display_name, handle, avatar_url, account_type, credit_balance')
      .eq('id', userId)
      .single()
    return data as UserProfile | null
  }

  async function refreshProfile() {
    if (!user) return
    const data = await fetchProfile(user.id)
    if (data) {
      setProfile(data)
      setNeedsOnboarding(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        if (p) {
          setProfile(p)
          setNeedsOnboarding(false)
        } else {
          setNeedsOnboarding(true)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const p = await fetchProfile(session.user.id)
        if (p) {
          setProfile(p)
          setNeedsOnboarding(false)
        } else {
          setNeedsOnboarding(true)
        }
      } else {
        setProfile(null)
        setNeedsOnboarding(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    const needsEmailConfirmation = !data.session && !!data.user
    return { error: null, userId: data.user?.id, needsEmailConfirmation }
  }

  async function signInWithOAuth(provider: Provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setNeedsOnboarding(false)
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, needsOnboarding, signIn, signUp, signInWithOAuth, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
