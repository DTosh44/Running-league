import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { isCloudConfigured, supabase } from './supabase'

export type AppUser = {
  id: string
  name: string
  email: string
  initials: string
}

type AuthContextValue = {
  user: AppUser | null
  loading: boolean
  cloudConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<'signed-in' | 'verify-email'>
  signOut: () => Promise<void>
  updateName: (name: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
}

type StoredAccount = AppUser & { password: string }

const SESSION_KEY = 'running-league-session-v2'
const demoEnabled = import.meta.env.DEV || import.meta.env.MODE === 'test'
const demoAccount: StoredAccount = {
  id: 'demo-darren',
  name: 'Darren Tosh',
  email: 'darren@runningleague.demo',
  password: 'Demo123!',
  initials: 'DT',
}

export const initialsFor = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

const mapCloudUser = (account: SupabaseUser): AppUser => {
  const name = String(account.user_metadata?.full_name || account.email?.split('@')[0] || 'Runner')
  return {
    id: account.id,
    name,
    email: account.email ?? '',
    initials: String(account.user_metadata?.initials || initialsFor(name) || 'RL'),
  }
}

const loadSession = (): AppUser | null => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') } catch { return null }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => isCloudConfigured || !demoEnabled ? null : loadSession())
  const [loading, setLoading] = useState(isCloudConfigured)

  useEffect(() => {
    if (!supabase) return
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user ? mapCloudUser(data.user) : null)
        setLoading(false)
      }
    }).catch(() => { if (mounted) setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ? mapCloudUser(session.user) : null)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    cloudConfigured: isCloudConfigured,
    async signIn(email, password) {
      const normalized = email.trim().toLowerCase()
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email address or password is incorrect.' : error.message)
        if (data.user) setUser(mapCloudUser(data.user))
        return
      }
      if (!demoEnabled) throw new Error('Account service is not configured yet. Please try again later.')
      const account = demoAccount.email === normalized ? demoAccount : undefined
      if (!account || account.password !== password) throw new Error('Email address or password is incorrect.')
      const nextUser = { id: account.id, name: account.name, email: account.email, initials: account.initials }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    },
    async signUp(name, email, password) {
      const normalized = email.trim().toLowerCase()
      const cleanName = name.trim()
      if (cleanName.length < 2) throw new Error('Please enter your name.')
      if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Enter a valid email address.')
      if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { full_name: cleanName, initials: initialsFor(cleanName) },
          },
        })
        if (error) throw new Error(error.message)
        if (data.user && data.session) {
          setUser(mapCloudUser(data.user))
          return 'signed-in'
        }
        return 'verify-email'
      }
      throw new Error('Secure account creation requires the live account service. Use the demo account to preview.')
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut()
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
    },
    async updateName(name) {
      const cleanName = name.trim()
      if (cleanName.length < 2) throw new Error('Please enter your name.')
      const initials = initialsFor(cleanName)
      if (supabase) {
        const { data, error } = await supabase.auth.updateUser({ data: { full_name: cleanName, initials } })
        if (error) throw new Error(error.message)
        if (data.user) setUser(mapCloudUser(data.user))
        return
      }
      if (!user) return
      const nextUser = { ...user, name: cleanName, initials }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    },
    async sendPasswordReset(email) {
      if (!supabase) throw new Error('Password resets are available when cloud accounts are enabled.')
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw new Error(error.message)
    },
    async updatePassword(password) {
      if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
      if (!supabase) throw new Error('Password updates are available when cloud accounts are enabled.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export const demoCredentials = { email: demoAccount.email, password: demoAccount.password }
