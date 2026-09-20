import { describe, expect, it } from 'vitest'
import { defaultPlanAnswers, generateTrainingPlan, parseDuration } from './planner'

describe('training plan generator', () => {
  it('parses race times', () => {
    expect(parseDuration('00:50:00')).toBe(3000)
    expect(parseDuration('25:30')).toBe(1530)
  })

  it('builds a progressive plan around selected days', () => {
    const answers = defaultPlanAnswers()
    answers.raceDate = '2026-12-13'
    answers.runsPerWeek = 3
    answers.preferredDays = ['Tuesday', 'Thursday', 'Sunday']
    answers.longRunDay = 'Sunday'

    const plan = generateTrainingPlan(answers, new Date('2026-09-20T12:00:00'))

    expect(plan.weeks).toHaveLength(12)
    expect(plan.weeks[0].sessions.filter((session) => session.type !== 'Strength')).toHaveLength(3)
    expect(plan.weeks[0].sessions.some((session) => session.day === 'Sunday' && session.type === 'Long run')).toBe(true)
    expect(plan.weeks.at(-1)?.isTaper).toBe(true)
  })

  it('rejects dates outside the supported plan range', () => {
    const answers = defaultPlanAnswers()
    answers.raceDate = '2027-12-20'
    expect(() => generateTrainingPlan(answers, new Date('2026-09-20T12:00:00'))).toThrow(/4 and 24/)
    answers.raceDate = '2026-09-22'
    expect(() => generateTrainingPlan(answers, new Date('2026-09-20T12:00:00'))).toThrow(/4 and 24/)
  })
})

describe('plan constraints', () => {
  it('keeps the chosen long-run day when extra available days were selected', () => {
    const answers = { ...defaultPlanAnswers(), preferredDays: ['Monday', 'Tuesday', 'Thursday', 'Sunday'] }
    const plan = generateTrainingPlan(answers)
    expect(plan.weeks[0].sessions.find((session) => session.type === 'Long run')?.day).toBe('Sunday')
    for (const week of plan.weeks) expect(week.totalKm).toBeCloseTo(week.sessions.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0), 1)
  })
  it('rejects unavailable long-run days and malformed durations', () => {
    const answers = { ...defaultPlanAnswers(), longRunDay: 'Monday' }
    expect(() => generateTrainingPlan(answers)).toThrow(/long-run day/)
    expect(parseDuration('00:99:00')).toBe(0)
    expect(parseDuration('-1:20')).toBe(0)
  })
})
