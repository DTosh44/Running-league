import { formatPace } from './scoring'
import type { PlanAnswers, RaceDistance, TrainingPlan, TrainingSession, TrainingWeek } from './types'

export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const raceDistanceKm: Record<RaceDistance, number> = {
  '5K': 5,
  '10K': 10,
  'Half marathon': 21.0975,
  'Marathon': 42.195,
}

export const defaultPlanAnswers = (): PlanAnswers => {
  const raceDate = new Date()
  raceDate.setDate(raceDate.getDate() + 84)
  return {
    raceDistance: '10K',
    raceDate: raceDate.toISOString().slice(0, 10),
    targetTime: '00:50:00',
    runsPerWeek: 3,
    preferredDays: ['Tuesday', 'Thursday', 'Sunday'],
    longRunDay: 'Sunday',
    experience: 'Building consistency',
    weeklyDistanceKm: 20,
    recentFiveK: '00:25:30',
    longestRunKm: 9,
    terrain: 'Road',
    strengthTraining: true,
    notes: '',
  }
}

export function parseDuration(value: string) {
  if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(value)) return 0
  const parts = value.split(':').map(Number)
  if (parts.slice(1).some((part) => part >= 60) || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}

const paceWindow = (centreSeconds: number, lower: number, upper: number) =>
  `${formatPace(centreSeconds + lower).replace('/km', '')}–${formatPace(centreSeconds + upper)}`

const orderedDays = (answers: PlanAnswers) => weekdays.filter((day) => answers.preferredDays.includes(day))

function sessionMix(count: number) {
  if (count <= 2) return ['Easy', 'Long run'] as const
  if (count === 3) return ['Intervals', 'Easy', 'Long run'] as const
  if (count === 4) return ['Easy', 'Intervals', 'Easy', 'Long run'] as const
  if (count === 5) return ['Easy', 'Intervals', 'Recovery', 'Tempo', 'Long run'] as const
  return ['Easy', 'Intervals', 'Recovery', 'Tempo', 'Easy', 'Long run'] as const
}

function makeSession(
  type: TrainingSession['type'],
  day: string,
  distanceKm: number,
  targetPaceSeconds: number,
  week: number,
): TrainingSession {
  const rounded = Math.max(2, Math.round(distanceKm * 10) / 10)
  if (type === 'Intervals') return {
    day,
    type,
    distanceKm: rounded,
    pace: paceWindow(targetPaceSeconds, -18, -5),
    detail: week < 4 ? '6 × 2 minutes controlled hard, with easy jog recoveries.' : '5 × 4 minutes at a controlled race-focused effort.',
  }
  if (type === 'Tempo') return {
    day,
    type,
    distanceKm: rounded,
    pace: paceWindow(targetPaceSeconds, 12, 28),
    detail: 'Warm up, run the middle section at a comfortably hard effort, then cool down.',
  }
  if (type === 'Long run') return {
    day,
    type,
    distanceKm: rounded,
    pace: paceWindow(targetPaceSeconds, 55, 95),
    detail: 'Keep this conversational. Time on feet matters more than pace.',
  }
  if (type === 'Recovery') return {
    day,
    type,
    distanceKm: rounded,
    pace: paceWindow(targetPaceSeconds, 85, 125),
    detail: 'Very easy running. Finish feeling fresher than you started.',
  }
  return {
    day,
    type,
    distanceKm: rounded,
    pace: paceWindow(targetPaceSeconds, 60, 105),
    detail: 'Relaxed aerobic running at a pace that allows full sentences.',
  }
}

export function generateTrainingPlan(answers: PlanAnswers, now = new Date()): TrainingPlan {
  const raceDate = new Date(`${answers.raceDate}T12:00:00`)
  const rawWeeks = Math.ceil((raceDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
  if (!Number.isFinite(rawWeeks) || rawWeeks < 4 || rawWeeks > 24) throw new Error('Choose a race between 4 and 24 weeks away for this plan builder.')
  if (!Number.isInteger(answers.runsPerWeek) || answers.runsPerWeek < 2 || answers.runsPerWeek > 6) throw new Error('Choose between 2 and 6 running days.')
  if (answers.preferredDays.length < answers.runsPerWeek || !answers.preferredDays.includes(answers.longRunDay)) throw new Error('Select enough running days and include your long-run day.')
  if (![answers.weeklyDistanceKm, answers.longestRunKm].every((n) => Number.isFinite(n) && n > 0) || answers.longestRunKm > answers.weeklyDistanceKm) throw new Error('Enter your current weekly distance and a longest run no greater than that weekly distance.')
  const weekCount = rawWeeks
  const distance = raceDistanceKm[answers.raceDistance]
  const targetSeconds = parseDuration(answers.targetTime)
  const recentSeconds = parseDuration(answers.recentFiveK)
  if (!targetSeconds || !recentSeconds) throw new Error('Enter valid target and recent 5K times.')
  const targetPaceSeconds = targetSeconds / distance
  const trainingPaceSeconds = Math.max(targetPaceSeconds, recentSeconds * Math.pow(distance / 5, 1.06) / distance)
  const days = orderedDays(answers)
  const activeDays = days.filter((day) => day !== answers.longRunDay).slice(0, answers.runsPerWeek - 1)
  activeDays.push(answers.longRunDay)

  const mix = sessionMix(answers.runsPerWeek)
  const peakMultiplier = answers.raceDistance === 'Marathon' ? 1.75 : answers.raceDistance === 'Half marathon' ? 1.45 : 1.25
  const peakWeeklyKm = Math.min(Math.max(answers.weeklyDistanceKm, distance * peakMultiplier), answers.weeklyDistanceKm * Math.pow(1.06, Math.max(0, weekCount - 3)))
  const weeks: TrainingWeek[] = []

  for (let index = 0; index < weekCount; index += 1) {
    const weekNumber = index + 1
    const remaining = weekCount - weekNumber
    const isTaper = remaining < 2
    const buildProgress = Math.min(1, index / Math.max(1, weekCount - 3))
    const baseKm = answers.weeklyDistanceKm + (peakWeeklyKm - answers.weeklyDistanceKm) * buildProgress
    const cutback = !isTaper && weekNumber % 4 === 0 ? 0.82 : 1
    const taper = isTaper ? (remaining === 1 ? 0.72 : 0.48) : 1
    const totalKm = Math.max(answers.runsPerWeek * 2, Math.round(baseKm * cutback * taper))
    const longShare = answers.runsPerWeek <= 3 ? 0.42 : 0.36
    const longDistance = Math.min(totalKm - (answers.runsPerWeek - 1) * 2, distance * 0.9, Math.max(2, answers.longestRunKm * Math.pow(1.05, index) * cutback * taper), totalKm * longShare)
    const otherTotal = Math.max(totalKm - longDistance, (answers.runsPerWeek - 1) * 2)
    const otherDistance = otherTotal / Math.max(1, answers.runsPerWeek - 1)

    const sessions = mix.slice(0, answers.runsPerWeek).map((type, sessionIndex) =>
      makeSession(answers.experience === 'New runner' && (type === 'Intervals' || type === 'Tempo') ? 'Easy' : type, activeDays[sessionIndex] ?? weekdays[sessionIndex], type === 'Long run' ? longDistance : otherDistance, trainingPaceSeconds, weekNumber),
    )

    for (const session of sessions) {
      session.detail += answers.terrain === 'Road' ? '' : ' On trails and hills, use the described effort rather than chasing pace.'
    }
    if (answers.strengthTraining && weekNumber % 2 === 1) {
      sessions.push({
        day: activeDays[0] === 'Monday' ? 'Wednesday' : 'Monday',
        type: 'Strength',
        pace: '20–30 min',
        detail: 'Simple calf, glute and core strength. Keep it controlled.',
      })
    }

    weeks.push({
      week: weekNumber,
      label: `Week ${weekNumber}`,
      focus: isTaper ? 'Freshen up' : weekNumber % 4 === 0 ? 'Absorb the work' : index < weekCount / 2 ? 'Build consistency' : 'Race-specific fitness',
      totalKm: Math.round(sessions.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0) * 10) / 10,
      sessions,
      isTaper,
    })
  }

  return {
    createdAt: now.toISOString(),
    answers,
    weeks,
    targetPace: formatPace(targetPaceSeconds),
    summary: `${weekCount} weeks · ${answers.runsPerWeek} runs a week · ${answers.terrain.toLowerCase()} focused`,
  }
}
