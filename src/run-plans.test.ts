import { beforeEach, describe, expect, it } from 'vitest'
import {
  calendarDays, createPlannedRuns, dateKey, deletePlannedRun, formatPace, listPlannedRuns,
  parsePace, shareRunUrl, shiftView, toLocalDateTime, updatePlannedRun, validateRunDraft,
  viewRange, weeklyOccurrences, type RunDraft,
} from './run-plans'

const runner = { id: 'demo-run-plans-test', name: 'Alex Runner' }
const draft: RunDraft = {
  leagueId: 'sunday-miles',
  title: 'Tuesday easy miles',
  startsAtLocal: '2030-06-04T18:30',
  meetingPoint: 'Recreation Ground',
  distanceKm: 8,
  paceSecondsPerKm: 330,
  notes: 'Chatty pace',
  repeatWeeks: 1,
}

beforeEach(() => {
  localStorage.clear()
})

describe('Run Plans dates and input', () => {
  it('defaults to Monday–Sunday and supports day and month views', () => {
    const date = new Date(2026, 10, 6, 12)
    expect(dateKey(viewRange('week', date).start)).toBe('2026-11-02')
    expect(dateKey(viewRange('week', date).end)).toBe('2026-11-09')
    expect(calendarDays(viewRange('month', date).start, viewRange('month', date).end)).toHaveLength(42)
    expect(dateKey(shiftView('day', date, 1))).toBe('2026-11-07')
    expect(dateKey(shiftView('week', date, -1))).toBe('2026-10-30')
  })

  it('creates weekly occurrences at the same local time', () => {
    const dates = weeklyOccurrences('2030-06-04T18:30', 4)
    expect(dates).toHaveLength(4)
    expect(dates.map((iso) => toLocalDateTime(new Date(iso)))).toEqual([
      '2030-06-04T18:30', '2030-06-11T18:30', '2030-06-18T18:30', '2030-06-25T18:30',
    ])
  })

  it('validates pace, required fields, and future dates', () => {
    expect(parsePace('5:30')).toBe(330)
    expect(formatPace(parsePace('5:30'))).toBe('5:30/km')
    expect(parsePace('')).toBeNull()
    expect(() => parsePace('5:90')).toThrow()
    expect(() => validateRunDraft(draft)).not.toThrow()
    expect(() => validateRunDraft({ ...draft, meetingPoint: '' })).toThrow(/meeting point/i)
    expect(() => validateRunDraft({ ...draft, startsAtLocal: '2020-01-01T18:00' })).toThrow(/future/i)
  })
})

describe('Run Plans demo persistence', () => {
  it('adds, edits and cancels a run without touching logged activities', async () => {
    await createPlannedRuns(runner, draft)
    const range = { start: new Date('2030-06-01T00:00:00Z'), end: new Date('2030-06-10T00:00:00Z') }
    const plans = await listPlannedRuns(runner, draft.leagueId, range)
    expect(plans).toHaveLength(1)
    expect(plans[0].attendees).toEqual([{ userId: runner.id, name: runner.name }])
    await updatePlannedRun(runner, plans[0], { ...draft, title: 'Evening eight' })
    const updated = await listPlannedRuns(runner, draft.leagueId, range)
    expect(updated[0].title).toBe('Evening eight')
    await deletePlannedRun(runner, updated[0])
    expect(await listPlannedRuns(runner, draft.leagueId, range)).toEqual([])
  })

  it('creates eight individually editable dates when repeating weekly', async () => {
    await createPlannedRuns(runner, { ...draft, repeatWeeks: 8 })
    const range = { start: new Date('2030-06-01T00:00:00Z'), end: new Date('2030-08-01T00:00:00Z') }
    const plans = await listPlannedRuns(runner, draft.leagueId, range)
    expect(plans).toHaveLength(8)
    expect(new Set(plans.map((plan) => plan.seriesId)).size).toBe(1)
    expect(plans[0].seriesId).toBeTruthy()
    await deletePlannedRun(runner, plans[0])
    expect(await listPlannedRuns(runner, draft.leagueId, range)).toHaveLength(7)
  })

  it('shares only a members-only link, not the meeting location', async () => {
    await createPlannedRuns(runner, draft)
    const [plan] = await listPlannedRuns(runner, draft.leagueId, {
      start: new Date('2030-06-01T00:00:00Z'), end: new Date('2030-06-10T00:00:00Z'),
    })
    const link = shareRunUrl(plan, 'https://running-league-alpha.vercel.app')
    expect(link).toContain('/app/run-plans?league=')
    expect(link).toContain('run=')
    expect(link).not.toContain('Recreation')
  })
})
