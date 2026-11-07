import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { demoActivities, leagueMembers } from './data'
import { calculateRunScore } from './scoring'
import { validateEvidenceFiles, validateEvidenceFile } from './verified-evidence'
import { getAccessToken, supabase } from './supabase'
import type { ActivityRecord, EvidenceReviewRow, EvidenceStatus, League, LeagueTableEntry, TrainingPlan, UserPreferences } from './types'

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
  evidenceStatuses: EvidenceStatus[]
  plan: TrainingPlan | null
  completedSessions: string[]
  preferences: UserPreferences
  stravaAvailable: boolean
  stravaConnected: boolean
  addActivity: (activity: NewActivity) => Promise<void>
  createLeague: (input: { name: string; description: string; seasonWeeks: number; runsPerWeek: number; requireVerifiedRuns?: boolean }) => Promise<League>
  joinLeague: (code: string) => Promise<void>
  getLeagueTable: (leagueId: string) => Promise<LeagueTableEntry[]>
  submitScreenshotEvidence: (input: NewActivity, leagueId: string, screenshots: File[], flags: string[], detectedElapsedSeconds: number | null) => Promise<void>
  getEvidenceQueue: (leagueId: string) => Promise<EvidenceReviewRow[]>
  reviewEvidence: (evidenceId: string, decision: 'approved' | 'rejected', note?: string) => Promise<void>
  getEvidenceLinks: (paths: string[]) => Promise<string[]>
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
    source: String(row.provider_external_id ?? '').startsWith('screenshot:') ? 'Strava screenshot' : String(row.source || 'Manual') as ActivityRecord['source'],
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
  requireVerifiedRuns: Boolean(row.require_verified_runs),
})

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [evidenceStatuses, setEvidenceStatuses] = useState<EvidenceStatus[]>([])
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [completedSessions, setCompletedSessions] = useState<string[]>([])
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [stravaAvailable, setStravaAvailable] = useState(false)
  const [stravaConnected, setStravaConnected] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setActivities([])
      setLeagues([])
      setEvidenceStatuses([])
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
        setEvidenceStatuses([])
        setPlan(readLocal<TrainingPlan | null>(localKey(user.id, 'plan'), null))
        setCompletedSessions(readLocal<string[]>(localKey(user.id, 'completed'), []))
        setPreferences(readLocal<UserPreferences>(localKey(user.id, 'preferences'), defaultPreferences))
        return
      }

      const [activityResult, leagueResult, planResult, preferenceResult, evidenceResult] = await Promise.all([
        supabase.from('activities').select('*').eq('user_id', user.id).order('occurred_at', { ascending: false }),
        supabase.rpc('my_leagues'),
        supabase.from('training_plans').select('plan, completed_sessions').maybeSingle(),
        supabase.from('preferences').select('weekly_email, league_notifications, public_profile').maybeSingle(),
        supabase.from('activity_evidence').select('activity_id, league_id, status, client_flags').eq('user_id', user.id),
      ])
      if (activityResult.error) throw activityResult.error
      if (leagueResult.error) throw leagueResult.error
      if (planResult.error) throw planResult.error
      if (preferenceResult.error) throw preferenceResult.error
      if (evidenceResult.error) throw evidenceResult.error
      setEvidenceStatuses((evidenceResult.data ?? []).map((row) => ({
        activityId: String(row.activity_id), leagueId: String(row.league_id),
        status: row.status as EvidenceStatus['status'], flags: (row.client_flags as string[]) ?? [],
      })))
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
    evidenceStatuses,
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
          source: input.source === 'Strava screenshot' ? 'Manual' : input.source,
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
        const { data, error } = await supabase.rpc(input.requireVerifiedRuns ? 'create_verified_league' : 'create_league', {
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
      const league = mapLeague({ id: crypto.randomUUID(), code: Math.random().toString(36).slice(2, 8).toUpperCase(), created_at: new Date().toISOString(), member_count: 1, ...input, season_weeks: input.seasonWeeks, runs_per_week: input.runsPerWeek, require_verified_runs: input.requireVerifiedRuns }, 'owner')
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
    async submitScreenshotEvidence(input, leagueId, screenshots, flags, detectedElapsedSeconds) {
      if (!user || !supabase) throw new Error('Verified screenshot submissions require a live Running League account.')
      if (!leagues.some((league) => league.id === leagueId)) throw new Error('Join or create a league before submitting evidence.')
      validateEvidenceFiles(screenshots)
      const uploadId = crypto.randomUUID()
      const uploadedPaths: string[] = []
      let submitted = false
      try {
        for (const [index, file] of screenshots.entries()) {
          const extension = validateEvidenceFile(file)
          const path = user.id + '/' + uploadId + '/' + (index === 0 ? 'overview' : 'details') + '.' + extension
          const mime = extension === 'jpg' ? 'image/jpeg' : 'image/' + extension
          const { error: uploadError } = await supabase.storage.from('run-evidence')
            .upload(path, file, { cacheControl: '3600', upsert: false, contentType: mime })
          if (uploadError) throw new Error('Could not upload private screenshot evidence: ' + uploadError.message)
          uploadedPaths.push(path)
        }
        const { error: submitError } = await supabase.rpc('submit_evidenced_run', {
          league_id_input: leagueId,
          run_name_input: input.name,
          occurred_at_input: input.occurredAt,
          distance_km_input: input.distanceKm,
          elevation_m_input: input.elevationM,
          elapsed_seconds_input: input.elapsedSeconds,
          training_input: input.training ?? false,
          screenshot_paths_input: uploadedPaths,
          client_flags_input: flags.slice(0, 10).map((flag) => flag.slice(0, 90)),
          detected_elapsed_seconds_input: detectedElapsedSeconds,
        })
        if (submitError) throw new Error(submitError.code === '23505'
          ? 'This run has already been submitted. Your earlier entry is still on record.'
          : submitError.message)
        submitted = true
        await refresh()
      } catch (caught) {
        if (!submitted && uploadedPaths.length) {
          // The private Storage policy permits cleanup only before a successful submission.
          await supabase.storage.from('run-evidence').remove(uploadedPaths).catch(() => undefined)
        }
        throw caught
      }
    },
    async getEvidenceQueue(leagueId) {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('league_evidence_queue', { league_id_input: leagueId })
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id), activityId: String(row.activity_id),
        runnerId: String(row.runner_id), runnerName: String(row.runner_name),
        runName: String(row.run_name), occurredAt: String(row.occurred_at),
        distanceKm: Number(row.distance_km), elevationM: Number(row.elevation_m),
        elapsedSeconds: Number(row.elapsed_seconds),
        status: row.status as EvidenceReviewRow['status'],
        flags: (row.client_flags as string[]) ?? [],
        screenshotPaths: (row.screenshot_paths as string[]) ?? [],
        reviewNote: String(row.review_note ?? ''), createdAt: String(row.created_at),
      }))
    },
    async reviewEvidence(evidenceId, decision, note = '') {
      if (!supabase) throw new Error('Evidence moderation requires live accounts.')
      const { error } = await supabase.rpc('review_run_evidence', {
        evidence_id_input: evidenceId, decision_input: decision, note_input: note,
      })
      if (error) throw error
      await refresh()
    },
    async getEvidenceLinks(paths) {
      if (!supabase) throw new Error('Private evidence requires a live account.')
      if (paths.length < 1 || paths.length > 2) throw new Error('Invalid evidence file list.')
      const urls = await Promise.all(paths.map(async (path) => {
        const { data, error } = await supabase.storage.from('run-evidence').createSignedUrl(path, 180)
        if (error || !data?.signedUrl) throw new Error('This screenshot is not available to your account.')
        return data.signedUrl
      }))
      return urls
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
  }), [activities, completedSessions, error, evidenceStatuses, leagues, loading, plan, preferences, refresh, stravaAvailable, stravaConnected, user])

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatform() {
  const context = useContext(PlatformContext)
  if (!context) throw new Error('usePlatform must be used inside PlatformProvider')
  return context
}
