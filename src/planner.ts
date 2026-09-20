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
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
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
  const weekCount = Math.max(4, Math.min(24, rawWeeks))
  const distance = raceDistanceKm[answers.raceDistance]
  const targetSeconds = parseDuration(answers.targetTime)
  const targetPaceSeconds = targetSeconds > 0 ? targetSeconds / distance : parseDuration(answers.recentFiveK) / 5
  const days = orderedDays(answers)
  const activeDays = days.length >= answers.runsPerWeek
    ? days.slice(0, answers.runsPerWeek)
    : weekdays.filter((day) => day !== 'Friday').slice(0, answers.runsPerWeek)
  if (activeDays.includes(answers.longRunDay)) {
    activeDays.splice(activeDays.indexOf(answers.longRunDay), 1)
    activeDays.push(answers.longRunDay)
  }

  const mix = sessionMix(answers.runsPerWeek)
  const peakMultiplier = answers.raceDistance === 'Marathon' ? 1.75 : answers.raceDistance === 'Half marathon' ? 1.45 : 1.25
  const peakWeeklyKm = Math.max(answers.weeklyDistanceKm, distance * peakMultiplier)
  const weeks: TrainingWeek[] = []

  for (let index = 0; index < weekCount; index += 1) {
    const weekNumber = index + 1
    const remaining = weekCount - weekNumber
    const isTaper = remaining < 2
    const buildProgress = Math.min(1, index / Math.max(1, weekCount - 3))
    const baseKm = answers.weeklyDistanceKm + (peakWeeklyKm - answers.weeklyDistanceKm) * buildProgress
    const cutback = !isTaper && weekNumber % 4 === 0 ? 0.82 : 1
    const taper = isTaper ? (remaining === 1 ? 0.72 : 0.48) : 1
    const totalKm = Math.max(answers.runsPerWeek * 3, Math.round(baseKm * cutback * taper))
    const longShare = answers.runsPerWeek <= 3 ? 0.42 : 0.36
    const longDistance = Math.min(distance * 0.9, Math.max(answers.longestRunKm, totalKm * longShare))
    const otherTotal = Math.max(totalKm - longDistance, (answers.runsPerWeek - 1) * 2)
    const otherDistance = otherTotal / Math.max(1, answers.runsPerWeek - 1)

    const sessions = mix.slice(0, answers.runsPerWeek).map((type, sessionIndex) =>
      makeSession(type, activeDays[sessionIndex] ?? weekdays[sessionIndex], type === 'Long run' ? longDistance : otherDistance, targetPaceSeconds, weekNumber),
    )

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
      totalKm,
      sessions,
      isTaper,
    })
  }

  return {
    createdAt: new Date().toISOString(),
    answers,
    weeks,
    targetPace: formatPace(targetPaceSeconds),
    summary: `${weekCount} weeks · ${answers.runsPerWeek} runs a week · ${answers.terrain.toLowerCase()} focused`,
  }
}
