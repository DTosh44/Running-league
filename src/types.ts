import type { RunScore, RunScoreInput } from './scoring'

export type ActivityRecord = RunScoreInput & {
  id: string
  name: string
  date: string
  occurredAt?: string
  location: string
  source: 'Garmin' | 'Strava' | 'Strava screenshot' | 'FIT upload' | 'GPX upload' | 'Manual'
  training?: boolean
  providerExternalId?: string
  score: RunScore
}

export type LeagueMember = {
  id: string
  name: string
  initials: string
  weeklyPoints: number
  seasonPoints: number
  runs: number
  movement: number
  colour: string
}

export type RaceDistance = '5K' | '10K' | 'Half marathon' | 'Marathon'
export type ExperienceLevel = 'New runner' | 'Building consistency' | 'Experienced' | 'Performance focused'

export type PlanAnswers = {
  raceDistance: RaceDistance
  raceDate: string
  targetTime: string
  runsPerWeek: number
  preferredDays: string[]
  longRunDay: string
  experience: ExperienceLevel
  weeklyDistanceKm: number
  recentFiveK: string
  longestRunKm: number
  terrain: 'Road' | 'Trail' | 'Mixed'
  strengthTraining: boolean
  notes: string
}

export type TrainingSession = {
  day: string
  type: 'Easy' | 'Intervals' | 'Tempo' | 'Long run' | 'Recovery' | 'Strength'
  distanceKm?: number
  pace: string
  detail: string
}

export type TrainingWeek = {
  week: number
  label: string
  focus: string
  totalKm: number
  sessions: TrainingSession[]
  isTaper: boolean
}

export type TrainingPlan = {
  createdAt: string
  answers: PlanAnswers
  weeks: TrainingWeek[]
  targetPace: string
  summary: string
}

export type League = {
  id: string
  name: string
  code: string
  description: string
  seasonWeeks: number
  runsPerWeek: number
  memberCount: number
  role: 'owner' | 'member'
  createdAt: string
  requireVerifiedRuns?: boolean
}

export type LeagueTableEntry = {
  userId: string
  name: string
  initials: string
  weeklyPoints: number
  seasonPoints: number
  runs: number
}

export type UserPreferences = {
  weeklyEmail: boolean
  leagueNotifications: boolean
  publicProfile: boolean
}


export type EvidenceStatus = {
  activityId: string
  leagueId: string
  status: 'pending' | 'approved' | 'rejected'
  flags: string[]
}

export type EvidenceReviewRow = {
  id: string
  activityId: string
  runnerId: string
  runnerName: string
  runName: string
  occurredAt: string
  distanceKm: number
  elevationM: number
  elapsedSeconds: number
  status: 'pending' | 'approved' | 'rejected'
  flags: string[]
  screenshotPaths: string[]
  reviewNote: string
  createdAt: string
}
