import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type User = {
  name: string
  email: string
  initials: string
}

type AuthContextValue = {
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

type StoredAccount = User & { password: string }

const SESSION_KEY = 'running-league-session-v1'
const ACCOUNTS_KEY = 'running-league-accounts-v1'
const demoAccount: StoredAccount = {
  name: 'Darren Tosh',
  email: 'darren@runningleague.demo',
  password: 'Demo123!',
  initials: 'DT',
}

const initialsFor = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

const loadSession = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
  } catch {
    return null
  }
}

const loadAccounts = (): StoredAccount[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadSession())

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async signIn(email, password) {
      const normalized = email.trim().toLowerCase()
      const account = [demoAccount, ...loadAccounts()].find((candidate) => candidate.email.toLowerCase() === normalized)
      if (!account || account.password !== password) throw new Error('Email address or password is incorrect.')
      const nextUser = { name: account.name, email: account.email, initials: account.initials }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    },
    async signUp(name, email, password) {
      const normalized = email.trim().toLowerCase()
      if (name.trim().length < 2) throw new Error('Please enter your name.')
      if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Enter a valid email address.')
      if (password.length < 8) throw new Error('Use at least 8 characters for your password.')
      if ([demoAccount, ...loadAccounts()].some((account) => account.email.toLowerCase() === normalized)) {
        throw new Error('An account already exists for that email address.')
      }
      const account = { name: name.trim(), email: normalized, password, initials: initialsFor(name) }
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...loadAccounts(), account]))
      const nextUser = { name: account.name, email: account.email, initials: account.initials }
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    },
    signOut() {
      localStorage.removeItem(SESSION_KEY)
      setUser(null)
    },
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export const demoCredentials = { email: demoAccount.email, password: demoAccount.password }
