import { supabase } from './supabase'

export type RunPlansView = 'day' | 'week' | 'month'

export type RunAttendee = { userId: string; name: string }

export type PlannedRun = {
  id: string
  leagueId: string
  createdBy: string
  hostName: string
  title: string
  startsAt: string
  meetingPoint: string
  distanceKm: number | null
  paceSecondsPerKm: number | null
  notes: string
  seriesId: string | null
  attendees: RunAttendee[]
}

export type RunDraft = {
  leagueId: string
  title: string
  startsAtLocal: string
  meetingPoint: string
  distanceKm: number | null
  paceSecondsPerKm: number | null
  notes: string
  repeatWeeks: 1 | 4 | 8
}

export type Runner = { id: string; name: string }

const pad = (value: number) => String(value).padStart(2, '0')
const storageKey = (userId: string) => 'running-league-' + userId + '-run-plans-v1'

export function dateKey(date: Date): string {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

export function toLocalDateTime(date: Date): string {
  return dateKey(date) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes())
}

export function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function plusDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function weekStart(date: Date): Date {
  const result = dayStart(date)
  result.setDate(result.getDate() - (result.getDay() + 6) % 7)
  return result
}

export function viewRange(view: RunPlansView, date: Date): { start: Date; end: Date } {
  if (view === 'day') {
    const start = dayStart(date)
    return { start, end: plusDays(start, 1) }
  }
  if (view === 'week') {
    const start = weekStart(date)
    return { start, end: plusDays(start, 7) }
  }
  const start = weekStart(new Date(date.getFullYear(), date.getMonth(), 1))
  return { start, end: plusDays(start, 42) }
}

export function shiftView(view: RunPlansView, date: Date, direction: number): Date {
  if (view === 'month') return new Date(date.getFullYear(), date.getMonth() + direction, 1)
  return plusDays(date, direction * (view === 'week' ? 7 : 1))
}

export function calendarDays(start: Date, end: Date): Date[] {
  const days: Date[] = []
  for (let current = new Date(start); current < end; current = plusDays(current, 1)) days.push(current)
  return days
}

export function weeklyOccurrences(startsAtLocal: string, count: 1 | 4 | 8): string[] {
  const start = new Date(startsAtLocal)
  if (!Number.isFinite(start.getTime())) throw new Error('Choose a valid date and time.')
  return Array.from({ length: count }, (_, index) => plusDays(start, index * 7).toISOString())
}

export function parsePace(value: string): number | null {
  if (!value.trim()) return null
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim())
  if (!match) throw new Error('Enter pace as minutes:seconds per km, for example 5:30.')
  const seconds = Number(match[1]) * 60 + Number(match[2])
  if (seconds < 150 || seconds > 1200) throw new Error('Pace must be between 2:30 and 20:00 per km.')
  return seconds
}

export function formatPace(seconds: number | null): string {
  if (seconds === null) return 'Any pace'
  return Math.floor(seconds / 60) + ':' + pad(seconds % 60) + '/km'
}

export function validateRunDraft(draft: RunDraft): void {
  if (draft.title.trim().length < 2 || draft.title.trim().length > 100) throw new Error('Run name must be 2–100 characters.')
  if (draft.meetingPoint.trim().length < 2 || draft.meetingPoint.trim().length > 200) throw new Error('Add a meeting point (2–200 characters).')
  if (draft.notes.length > 1000) throw new Error('Notes must be under 1,000 characters.')
  if (draft.distanceKm !== null && (!Number.isFinite(draft.distanceKm) || draft.distanceKm <= 0 || draft.distanceKm > 200)) throw new Error('Distance must be between 0 and 200 km.')
  if (draft.paceSecondsPerKm !== null && (draft.paceSecondsPerKm < 150 || draft.paceSecondsPerKm > 1200)) throw new Error('Pace is outside the supported range.')
  const when = new Date(draft.startsAtLocal)
  if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) throw new Error('Choose a future date and time.')
}

function readDemoRuns(userId: string): PlannedRun[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    return Array.isArray(value) ? value as PlannedRun[] : []
  } catch {
    return []
  }
}

function writeDemoRuns(userId: string, runs: PlannedRun[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(runs))
}

export async function listPlannedRuns(user: Runner, leagueId: string, range: { start: Date; end: Date }): Promise<PlannedRun[]> {
  if (!supabase) return readDemoRuns(user.id)
    .filter((run) => run.leagueId === leagueId && run.startsAt >= range.start.toISOString() && run.startsAt < range.end.toISOString())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const { data, error } = await supabase.rpc('list_run_plans', {
    league_id_input: leagueId,
    range_start: range.start.toISOString(),
    range_end: range.end.toISOString(),
  })
  if (error) throw new Error(error.code === '42883' ? 'Run Plans is not yet enabled in the database. Apply the Run Plans migration.' : error.message)

  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : []
  return rows.map((item): PlannedRun => ({
    id: String(item.id),
    leagueId: String(item.leagueId),
    createdBy: String(item.createdBy),
    hostName: String(item.hostName),
    title: String(item.title),
    startsAt: String(item.startsAt),
    meetingPoint: String(item.meetingPoint),
    distanceKm: item.distanceKm == null ? null : Number(item.distanceKm),
    paceSecondsPerKm: item.paceSecondsPerKm == null ? null : Number(item.paceSecondsPerKm),
    notes: String(item.notes || ''),
    seriesId: item.seriesId ? String(item.seriesId) : null,
    attendees: Array.isArray(item.attendees) ? (item.attendees as Record<string, unknown>[]).map((person) => ({
      userId: String(person.userId), name: String(person.name),
    })) : [],
  }))
}

export async function createPlannedRuns(user: Runner, draft: RunDraft): Promise<void> {
  validateRunDraft(draft)
  const occurrences = weeklyOccurrences(draft.startsAtLocal, draft.repeatWeeks)
  const seriesId = draft.repeatWeeks > 1 ? crypto.randomUUID() : null

  if (supabase) {
    const { error } = await supabase.from('run_plans').insert(occurrences.map((date) => ({
      league_id: draft.leagueId,
      created_by: user.id,
      title: draft.title.trim(),
      starts_at: date,
      meeting_point: draft.meetingPoint.trim(),
      distance_km: draft.distanceKm,
      pace_seconds_per_km: draft.paceSecondsPerKm,
      notes: draft.notes.trim(),
      series_id: seriesId,
    })))
    if (error) throw error
    return
  }

  const created = occurrences.map((date): PlannedRun => ({
    id: crypto.randomUUID(),
    leagueId: draft.leagueId,
    createdBy: user.id,
    hostName: user.name,
    title: draft.title.trim(),
    startsAt: date,
    meetingPoint: draft.meetingPoint.trim(),
    distanceKm: draft.distanceKm,
    paceSecondsPerKm: draft.paceSecondsPerKm,
    notes: draft.notes.trim(),
    seriesId,
    attendees: [{ userId: user.id, name: user.name }],
  }))
  writeDemoRuns(user.id, [...readDemoRuns(user.id), ...created])
}

export async function updatePlannedRun(user: Runner, plan: PlannedRun, draft: RunDraft): Promise<void> {
  validateRunDraft(draft)
  if (supabase) {
    const { error } = await supabase.from('run_plans').update({
      title: draft.title.trim(),
      starts_at: new Date(draft.startsAtLocal).toISOString(),
      meeting_point: draft.meetingPoint.trim(),
      distance_km: draft.distanceKm,
      pace_seconds_per_km: draft.paceSecondsPerKm,
      notes: draft.notes.trim(),
    }).eq('id', plan.id).eq('created_by', user.id)
    if (error) throw error
    return
  }
  const next = readDemoRuns(user.id).map((run) => run.id === plan.id ? {
    ...run,
    title: draft.title.trim(),
    startsAt: new Date(draft.startsAtLocal).toISOString(),
    meetingPoint: draft.meetingPoint.trim(),
    distanceKm: draft.distanceKm,
    paceSecondsPerKm: draft.paceSecondsPerKm,
    notes: draft.notes.trim(),
  } : run)
  writeDemoRuns(user.id, next)
}

export async function deletePlannedRun(user: Runner, plan: PlannedRun): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('run_plans').delete().eq('id', plan.id).eq('created_by', user.id)
    if (error) throw error
    return
  }
  writeDemoRuns(user.id, readDemoRuns(user.id).filter((run) => run.id !== plan.id))
}

export async function setRunAttendance(user: Runner, plan: PlannedRun, attending: boolean): Promise<void> {
  if (plan.createdBy === user.id) throw new Error('You are already attending the run you organised.')
  if (supabase) {
    const query = supabase.from('run_plan_attendees')
    const { error } = attending
      ? await query.insert({ plan_id: plan.id, user_id: user.id })
      : await query.delete().eq('plan_id', plan.id).eq('user_id', user.id)
    if (error) throw error
    return
  }
  const next = readDemoRuns(user.id).map((run) => run.id === plan.id ? {
    ...run,
    attendees: attending ? [...run.attendees.filter((p) => p.userId !== user.id), { userId: user.id, name: user.name }]
      : run.attendees.filter((p) => p.userId !== user.id),
  } : run)
  writeDemoRuns(user.id, next)
}

export function shareRunUrl(plan: PlannedRun, origin: string): string {
  const url = new URL('/app/run-plans', origin)
  url.searchParams.set('league', plan.leagueId)
  url.searchParams.set('date', dateKey(new Date(plan.startsAt)))
  url.searchParams.set('run', plan.id)
  return url.toString()
}
