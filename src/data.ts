import { calculateRunScore } from './scoring'
import type { ActivityRecord, LeagueMember } from './types'

const activityInputs: Omit<ActivityRecord, 'score'>[] = [
  {
    id: 'run-1',
    name: 'Tuesday intervals',
    date: 'Today, 07:12',
    location: 'Victoria Park',
    source: 'Garmin',
    distanceKm: 6.42,
    elevationM: 92,
    elapsedSeconds: 31 * 60 + 10,
    paceBlocks: [
      { seconds: 600, speedMps: 3.1 },
      { seconds: 210, speedMps: 4.9 },
      { seconds: 120, speedMps: 2.7 },
      { seconds: 210, speedMps: 5.0 },
      { seconds: 120, speedMps: 2.6 },
      { seconds: 210, speedMps: 5.05 },
      { seconds: 400, speedMps: 3.0 },
    ],
  },
  {
    id: 'run-2',
    name: 'Sunday long run',
    date: 'Sun, 08:04',
    location: 'Regent’s Canal',
    source: 'FIT upload',
    distanceKm: 16.18,
    elevationM: 138,
    elapsedSeconds: 91 * 60 + 34,
  },
  {
    id: 'run-3',
    name: 'Easy miles',
    date: 'Thu, 18:21',
    location: 'Hackney Marshes',
    source: 'Garmin',
    distanceKm: 7.06,
    elevationM: 54,
    elapsedSeconds: 39 * 60 + 44,
  },
  {
    id: 'run-4',
    name: 'Parkrun effort',
    date: 'Sat, 09:00',
    location: 'Highbury Fields',
    source: 'Manual',
    distanceKm: 5,
    elevationM: 38,
    elapsedSeconds: 22 * 60 + 48,
  },
]

export const demoActivities: ActivityRecord[] = activityInputs.map((activity) => ({
  ...activity,
  score: calculateRunScore(activity),
}))

export const leagueMembers: LeagueMember[] = [
  { id: 'm1', name: 'Maya Shah', initials: 'MS', weeklyPoints: 65, seasonPoints: 412, runs: 3, movement: 1, colour: '#6b4eff' },
  { id: 'm2', name: 'Darren Tosh', initials: 'DT', weeklyPoints: 61, seasonPoints: 398, runs: 3, movement: 2, colour: '#1646d8' },
  { id: 'm3', name: 'Jon Bell', initials: 'JB', weeklyPoints: 58, seasonPoints: 391, runs: 3, movement: -1, colour: '#6370a7' },
  { id: 'm4', name: 'Rhea Evans', initials: 'RE', weeklyPoints: 54, seasonPoints: 374, runs: 3, movement: 0, colour: '#876be8' },
  { id: 'm5', name: 'Ollie Grant', initials: 'OG', weeklyPoints: 49, seasonPoints: 351, runs: 2, movement: 3, colour: '#2d63da' },
  { id: 'm6', name: 'Nina Cole', initials: 'NC', weeklyPoints: 46, seasonPoints: 338, runs: 3, movement: -2, colour: '#7c86b7' },
]

export const feedItems = [
  { name: 'Maya', action: 'scored 24 on Hill Repeats', time: '18 min ago', initials: 'MS', colour: '#6b4eff' },
  { name: 'Jon', action: 'joined North London Ten', time: '1 hr ago', initials: 'JB', colour: '#6370a7' },
  { name: 'Rhea', action: 'moved up 2 places', time: 'Yesterday', initials: 'RE', colour: '#876be8' },
]
