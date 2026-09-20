export const scoringVersion = 'RunningScore v1.0'

export const scoringConfig = {
  benchmarkDistanceKm: 5,
  benchmarkTimeSeconds: 20 * 60 + 21,
  climbingMetresPerEffortKm: 100,
  riegelExponent: 1.06,
  normalisedEffortExponent: 4,
  performanceIndexFloor: 60,
  indexPointsPerLeaguePoint: 2,
  maximumPoints: 25,
  minimumPoints: 1,
  speedCapVsBenchmark: 1.25,
} as const

export type PaceBlock = {
  seconds: number
  speedMps: number
}

export type RunScoreInput = {
  distanceKm: number
  elevationM: number
  elapsedSeconds: number
  paceBlocks?: PaceBlock[]
}

export type ScoreBand = 'Gentle' | 'Easy' | 'Solid' | 'Strong' | 'Outstanding' | 'Peak performance'

export type RunScore = {
  points: number
  band: ScoreBand
  performanceIndex: number
  effortDistanceKm: number
  normalizedPaceSecondsPerKm: number
  intervalUplift: number
  reviewNote?: string
  version: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const pointsFromIndex = (index: number) => clamp(
  Math.round((index - scoringConfig.performanceIndexFloor) / scoringConfig.indexPointsPerLeaguePoint),
  scoringConfig.minimumPoints,
  scoringConfig.maximumPoints,
)

export function scoreBand(points: number): ScoreBand {
  if (points <= 5) return 'Gentle'
  if (points <= 10) return 'Easy'
  if (points <= 15) return 'Solid'
  if (points <= 20) return 'Strong'
  if (points <= 24) return 'Outstanding'
  return 'Peak performance'
}

export function formatPace(secondsPerKm: number) {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '—'
  const minutes = Math.floor(Math.round(secondsPerKm) / 60)
  const seconds = (Math.round(secondsPerKm) % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}/km`
}

export function calculateRunScore(input: RunScoreInput): RunScore {
  const distanceKm = Math.max(input.distanceKm, 0.01)
  const elevationM = Math.max(input.elevationM || 0, 0)
  const elapsedSeconds = Math.max(input.elapsedSeconds, 1)
  const benchmarkSpeed = scoringConfig.benchmarkDistanceKm * 1000 / scoringConfig.benchmarkTimeSeconds
  const effortDistanceKm = distanceKm + elevationM / scoringConfig.climbingMetresPerEffortKm

  const validBlocks = (input.paceBlocks ?? []).filter((block) => block.seconds > 0 && block.speedMps > 0)
  const blockSeconds = validBlocks.reduce((sum, block) => sum + block.seconds, 0)
  const cappedSpeed = benchmarkSpeed * scoringConfig.speedCapVsBenchmark
  const normalizedSpeed = blockSeconds > 0
    ? Math.pow(
        validBlocks.reduce(
          (sum, block) => sum + Math.pow(Math.min(block.speedMps, cappedSpeed), scoringConfig.normalisedEffortExponent) * block.seconds,
          0,
        ) / blockSeconds,
        1 / scoringConfig.normalisedEffortExponent,
      )
    : effortDistanceKm * 1000 / elapsedSeconds

  const distanceFactor = Math.pow(
    effortDistanceKm / scoringConfig.benchmarkDistanceKm,
    scoringConfig.riegelExponent - 1,
  )
  const performanceIndex = 100 * (normalizedSpeed / benchmarkSpeed) * distanceFactor
  const points = pointsFromIndex(performanceIndex)

  const baseSpeed = effortDistanceKm * 1000 / elapsedSeconds
  const baseIndex = 100 * (baseSpeed / benchmarkSpeed) * distanceFactor
  const intervalUplift = validBlocks.length ? Math.max(0, points - pointsFromIndex(baseIndex)) : 0

  return {
    points,
    band: scoreBand(points),
    performanceIndex,
    effortDistanceKm,
    normalizedPaceSecondsPerKm: 1000 / normalizedSpeed,
    intervalUplift,
    reviewNote: distanceKm < 2 ? 'Under 2 km — flagged for league eligibility review.' : undefined,
    version: scoringVersion,
  }
}

export const leagueRules = {
  scoringRunsPerWeek: 3,
  maximumScoringRunsPerDay: 1,
  seasonWeeks: 10,
  countedWeeks: 8,
} as const

// Match the database's Monday-to-Sunday league week in UK local time.
export function weeklyScoringRuns<T extends { occurredAt?: string; training?: boolean; score: { points: number } }>(activities: T[], limit = 3, now = new Date()): T[] {
  const ukDate = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
  const today = new Date(`${ukDate(now)}T12:00:00Z`)
  today.setUTCDate(today.getUTCDate() - (today.getUTCDay() + 6) % 7)
  const start = today.toISOString().slice(0, 10)
  const byDay = new Map<string, T>()
  for (const activity of activities) {
    if (activity.training || !activity.occurredAt) continue
    const occurred = new Date(activity.occurredAt)
    if (!Number.isFinite(occurred.getTime()) || occurred > now) continue
    const day = ukDate(occurred)
    if (day < start) continue
    if (!byDay.has(day) || byDay.get(day)!.score.points < activity.score.points) byDay.set(day, activity)
  }
  return [...byDay.values()].sort((a, b) => b.score.points - a.score.points).slice(0, limit)
}
