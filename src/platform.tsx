import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { demoActivities, leagueMembers } from './data'
import { calculateRunScore } from './scoring'
import { getAccessToken, supabase } from './supabase'
import type { ActivityRecord, League, LeagueTableEntry, TrainingPlan, UserPreferences } from './types'

type NewActivity = {
  name: string
  occurredAt: string
  location: string
  source: ActivityRecord['source']
  distanceKm: number
  elevationM: number
  elapsedSeconds: number
  training?: boolean
  providerExternalId?: string
}

type PlatformContextValue = {
  loading: boolean
  error: string
  activities: ActivityRecord[]
  leagues: League[]
  plan: TrainingPlan | null
  completedSessions: string[]
  preferences: UserPreferences
  stravaAvailable: boolean
  stravaConnected: boolean
  addActivity: (activity: NewActivity) => Promise<void>
  createLeague: (input: { name: string; description: string; seasonWeeks: number; runsPerWeek: number }) => Promise<League>
  joinLeague: (code: string) => Promise<void>
  getLeagueTable: (leagueId: string) => Promise<LeagueTableEntry[]>
  savePlan: (plan: TrainingPlan | null) => Promise<void>
  toggleSessionCompletion: (key: string) => Promise<void>
  updatePreferences: (preferences: UserPreferences) => Promise<void>
  connectStrava: () => Promise<void>
  syncStrava: () => Promise<void>
  refresh: () => Promise<void>
}

const defaultPreferences: UserPreferences = {
  weeklyEmail: true,
  leagueNotifications: true,
  publicProfile: false,
}

const PlatformContext = createContext<PlatformContextValue | null>(null)

const localKey = (userId: string, suffix: string) => `running-league-${userId}-${suffix}-v3`

const readLocal = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback }
}

const formatActivityDate = (value: string) => new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

const mapActivity = (row: Record<string, unknown>): ActivityRecord => {
  const scoreInput = {
    distanceKm: Number(row.distance_km),
    elevationM: Number(row.elevation_m),
    elapsedSeconds: Number(row.elapsed_seconds),
  }
  const occurredAt = String(row.occurred_at)
  return {
    id: String(row.id),
    name: String(row.name),
    occurredAt,
    date: formatActivityDate(occurredAt),
    location: String(row.location || 'Not specified'),
    source: String(row.source || 'Manual') as ActivityRecord['source'],
    training: Boolean(row.training),
    providerExternalId: row.provider_external_id ? String(row.provider_external_id) : undefined,
    ...scoreInput,
    score: (row.score as ActivityRecord['score'] | null) ?? calculateRunScore(scoreInput),
  }
}

const mapLeague = (row: Record<string, unknown>, role = 'member'): League => ({
  id: String(row.id),
  name: String(row.name),
  code: String(row.code),
  description: String(row.description || ''),
  seasonWeeks: Number(row.season_weeks || 10),
  runsPerWeek: Number(row.runs_per_week || 3),
  memberCount: Number(row.member_count || 1),
  role: role === 'owner' ? 'owner' : 'member',
  createdAt: String(row.created_at || new Date().toISOString()),
})

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [completedSessions, setCompletedSessions] = useState<string[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [stravaAvailable, setStravaAvailable] = useState(false)
  const [stravaConnected, setStravaConnected] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setActivities([])
      setLeagues([])
      setPlan(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      if (!supabase) {
        const seededActivities = user.id === 'demo-darren' ? demoActivities : []
        setActivities(readLocal(localKey(user.id, 'activities'), seededActivities))
        const demoLeagues: League[] = user.id === 'demo-darren' ? [
          { id: 'north-london-ten', name: 'North London Ten', code: 'NLT10', description: 'A friendly ten-week league.', seasonWeeks: 10, runsPerWeek: 3, memberCount: 10, role: 'member', createdAt: new Date().toISOString() },
          { id: 'sunday-miles', name: 'Sunday Miles', code: 'SUNMILES', description: 'A rolling friends league.', seasonWeeks: 10, runsPerWeek: 3, memberCount: 7, role: 'member', createdAt: new Date().toISOString() },
        ] : []
        setLeagues(readLocal(localKey(user.id, 'leagues'), demoLeagues))
        setPlan(readLocal<TrainingPlan | null>(localKey(user.id, 'plan'), null))
        setCompletedSessions(readLocal<string[]>(localKey(user.id, 'completed'), []))
        setPreferences(readLocal<UserPreferences>(localKey(user.id, 'preferences'), defaultPreferences))
        return
      }

      const [activityResult, leagueResult, planResult, preferenceResult] = await Promise.all([
        supabase.from('activities').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }),
        supabase.rpc('my_leagues'),
        supabase.from('training_plans').select('plan, completed_sessions').maybeSingle(),
        supabase.from('preferences').select('weekly_email, league_notifications, public_profile').maybeSingle(),
      ])
      if (activityResult.error) throw activityResult.error
      if (leagueResult.error) throw leagueResult.error
      if (planResult.error) throw planResult.error
      if (preferenceResult.error) throw preferenceResult.error
      setActivities((activityResult.data ?? []).map((row) => mapActivity(row as Record<string, unknown>)))
      setLeagues((leagueResult.data ?? []).map((row: Record<string, unknown>) => mapLeague(row, String(row.role))))
      const savedPlan = planResult.data?.plan as TrainingPlan | null | undefined
      setPlan(savedPlan ?? null)
      setCompletedSessions((planResult.data?.completed_sessions as string[] | undefined) ?? [])
      if (preferenceResult.data) {
        setPreferences({
          weeklyEmail: preferenceResult.data.weekly_email,
          leagueNotifications: preferenceResult.data.league_notifications,
          publicProfile: preferenceResult.data.public_profile,
        })
      }
      const token = await getAccessToken()
      if (token) {
        const response = await fetch('/api/strava/status', { headers: { Authorization: `Bearer ${token}` } })
        if (response.ok) { const result = await response.json(); setStravaConnected(Boolean(result.connected)); setStravaAvailable(Boolean(result.available)) }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your data could not be loaded. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(task)
  }, [refresh])

  const value = useMemo<PlatformContextValue>(() => ({
    loading,
    error,
    activities,
    leagues,
    plan,
    completedSessions,
    preferences,
    stravaAvailable,
    stravaConnected,
    async addActivity(input) {
      if (!user) throw new Error('Log in before adding an activity.')
      const score = calculateRunScore(input)
      if (supabase) {
        const { error } = await supabase.from('activities').insert({
          user_id: user.id,
          name: input.name,
          occurred_at: input.occurredAt,
          location: input.location,
          source: input.source,
          distance_km: input.distanceKm,
          elevation_m: input.elevationM,
          elapsed_seconds: input.elapsedSeconds,
          training: input.training ?? false,
          provider_external_id: input.providerExternalId ?? (input.source.includes('upload') ? `file:${input.occurredAt}:${input.distanceKm}:${input.elapsedSeconds}` : undefined),
          score,
          points: score.points,
        })
        if (error) throw new Error(error.code === '23505' ? 'This activity has already been imported.' : error.message)
        await refresh()
        return
      }
      const activity: ActivityRecord = { id: crypto.randomUUID(), date: formatActivityDate(input.occurredAt), ...input, score }
      const next = [activity, ...activities]
      localStorage.setItem(localKey(user.id, 'activities'), JSON.stringify(next))
      setActivities(next)
    },
    async createLeague(input) {
      if (!user) throw new Error('Log in before creating a league.')
      if (supabase) {
        const { data, error } = await supabase.rpc('create_league', {
          league_name: input.name,
          league_description: input.description,
          season_weeks_input: input.seasonWeeks,
          runs_per_week_input: input.runsPerWeek,
        })
        if (error) throw error
        const league = mapLeague(data as Record<string, unknown>, 'owner')
        await refresh()
        return league
      }
      const league = mapLeague({ id: crypto.randomUUID(), code: Math.random().toString(36).slice(2, 8).toUpperCase(), created_at: new Date().toISOString(), member_count: 1, ...input, season_weeks: input.seasonWeeks, runs_per_week: input.runsPerWeek }, 'owner')
      const next = [...leagues, league]
      localStorage.setItem(localKey(user.id, 'leagues'), JSON.stringify(next))
      setLeagues(next)
      return league
    },
    async joinLeague(code) {
      if (!user) throw new Error('Log in before joining a league.')
      if (supabase) {
        const { error } = await supabase.rpc('join_league', { join_code: code.trim().toUpperCase() })
        if (error) throw error
        await refresh()
        return
      }
      throw new Error('Joining another runner’s league requires cloud accounts to be enabled.')
    },
    async getLeagueTable(leagueId) {
      if (supabase) {
        const { data, error } = await supabase.rpc('league_table', { league_id_input: leagueId })
        if (error) throw error
        return (data ?? []).map((row: Record<string, unknown>) => ({
          userId: String(row.user_id), name: String(row.name), initials: String(row.initials),
          weeklyPoints: Number(row.weekly_points), seasonPoints: Number(row.season_points), runs: Number(row.runs),
        }))
      }
      if (leagueId === 'north-london-ten') return leagueMembers.map((member) => ({ userId: member.id, name: member.name, initials: member.initials, weeklyPoints: member.weeklyPoints, seasonPoints: member.seasonPoints, runs: member.runs }))
      return user ? [{ userId: user.id, name: user.name, initials: user.initials, weeklyPoints: activities.slice(0, 3).reduce((sum, item) => sum + item.score.points, 0), seasonPoints: 0, runs: Math.min(3, activities.length) }] : []
    },
    async savePlan(nextPlan) {
      if (!user) throw new Error('Log in before saving a plan.')
      if (supabase) {
        const { error } = await supabase.from('training_plans').upsert({ user_id: user.id, plan: nextPlan, completed_sessions: [] })
        if (error) throw error
      } else {
        localStorage.setItem(localKey(user.id, 'plan'), JSON.stringify(nextPlan))
        localStorage.setItem(localKey(user.id, 'completed'), '[]')
      }
      setPlan(nextPlan)
      setCompletedSessions([])
    },
    async toggleSessionCompletion(key) {
      if (!user) return
      const next = completedSessions.includes(key) ? completedSessions.filter((item) => item !== key) : [...completedSessions, key]
      if (supabase) {
        const { error } = await supabase.from('training_plans').update({ completed_sessions: next }).eq('user_id', user.id)
        if (error) throw error
      } else localStorage.setItem(localKey(user.id, 'completed'), JSON.stringify(next))
      setCompletedSessions(next)
    },
    async updatePreferences(nextPreferences) {
      if (!user) return
      setPreferences(nextPreferences)
      if (supabase) {
        const { error } = await supabase.from('preferences').upsert({ user_id: user.id, weekly_email: nextPreferences.weeklyEmail, league_notifications: nextPreferences.leagueNotifications, public_profile: nextPreferences.publicProfile })
        if (error) throw error
      } else localStorage.setItem(localKey(user.id, 'preferences'), JSON.stringify(nextPreferences))
    },
    async connectStrava() {
      const token = await getAccessToken()
      if (!token) throw new Error('Please log in again before connecting Strava.')
      const response = await fetch('/api/strava/start', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Strava connection could not be started.')
      window.location.assign(result.url)
    },
    async syncStrava() {
      const token = await getAccessToken()
      if (!token) throw new Error('Please log in again before syncing Strava.')
      const response = await fetch('/api/strava/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Strava sync failed.')
      await refresh()
    },
    refresh,
  }), [activities, completedSessions, error, leagues, loading, plan, preferences, refresh, stravaAvailable, stravaConnected, user])

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const context = useContext(PlatformContext)
  if (!context) throw new Error('usePlatform must be used inside PlatformProvider')
  return context
}
