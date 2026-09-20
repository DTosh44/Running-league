import type { RunScore, RunScoreInput } from './scoring'

export type ActivityRecord = RunScoreInput & {
  id: string
  name: string
  date: string
  location: string
  source: 'Garmin' | 'FIT upload' | 'Manual'
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
