import { createClient } from '@supabase/supabase-js'
import type { VercelRequest } from '@vercel/node'

const requireEnv = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export const appUrl = () => requireEnv('APP_URL').replace(/\/$/, '')
export const stravaClientId = () => requireEnv('STRAVA_CLIENT_ID')
export const stravaClientSecret = () => requireEnv('STRAVA_CLIENT_SECRET')

export const adminClient = () => createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
)

export async function authenticatedUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw new Error('Authentication required.')
  const client = adminClient()
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new Error('Your session has expired. Please log in again.')
  return { user: data.user, client }
}

type StravaActivity = {
  id: number
  name: string
  type: string
  sport_type?: string
  start_date: string
  timezone?: string
  distance: number
  elapsed_time: number
  total_elevation_gain: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function scoreActivity(distanceKm: number, elevationM: number, elapsedSeconds: number) {
  const effortDistanceKm = distanceKm + Math.max(0, elevationM) / 100
  const benchmarkSpeed = 5000 / (20 * 60 + 21)
  const normalizedSpeed = effortDistanceKm * 1000 / Math.max(1, elapsedSeconds)
  const distanceFactor = Math.pow(effortDistanceKm / 5, 0.06)
  const performanceIndex = 100 * (normalizedSpeed / benchmarkSpeed) * distanceFactor
  const points = clamp(Math.round((performanceIndex - 60) / 2), 1, 25)
  const band = points <= 5 ? 'Gentle' : points <= 10 ? 'Easy' : points <= 15 ? 'Solid' : points <= 20 ? 'Strong' : points <= 24 ? 'Outstanding' : 'Peak performance'
  return {
    points,
    band,
    performanceIndex,
    effortDistanceKm,
    normalizedPaceSecondsPerKm: 1000 / normalizedSpeed,
    intervalUplift: 0,
    version: 'RunningScore v1.0',
  }
}

export async function importStravaActivities(userId: string, accessToken: string, afterEpoch?: number) {
  const query = new URLSearchParams({ per_page: '100', page: '1' })
  if (afterEpoch) query.set('after', String(afterEpoch))
  const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Strava did not return your activities.')
  const activities = await response.json() as StravaActivity[]
  const runs = activities.filter((activity) => ['Run', 'TrailRun', 'VirtualRun'].includes(activity.sport_type || activity.type))
  if (!runs.length) return 0
  const rows = runs.map((activity) => {
    const distanceKm = activity.distance / 1000
    const score = scoreActivity(distanceKm, activity.total_elevation_gain, activity.elapsed_time)
    return {
      user_id: userId,
      name: activity.name || 'Strava run',
      occurred_at: activity.start_date,
      location: 'Strava activity',
      source: 'Strava',
      distance_km: distanceKm,
      elevation_m: Math.round(activity.total_elevation_gain || 0),
      elapsed_seconds: activity.elapsed_time,
      training: false,
      provider_external_id: `strava:${activity.id}`,
      score,
      points: score.points,
    }
  })
  const { error } = await adminClient().from('activities').upsert(rows, { onConflict: 'user_id,provider_external_id' })
  if (error) throw error
  return rows.length
}

export async function validStravaConnection(userId: string) {
  const client = adminClient()
  const { data, error } = await client.from('provider_connections').select('*').eq('user_id', userId).eq('provider', 'strava').maybeSingle()
  if (error || !data) throw new Error('Connect Strava before syncing activities.')
  if (Number(data.expires_at) > Math.floor(Date.now() / 1000) + 60) return data
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: stravaClientId(), client_secret: stravaClientSecret(), grant_type: 'refresh_token', refresh_token: data.refresh_token }),
  })
  if (!response.ok) throw new Error('Strava authorisation has expired. Please reconnect it.')
  const refreshed = await response.json()
  const next = { ...data, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expires_at: refreshed.expires_at, updated_at: new Date().toISOString() }
  const { error: updateError } = await client.from('provider_connections').upsert(next)
  if (updateError) throw updateError
  return next
}
