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

  it('caps unusually long plans at 24 weeks', () => {
    const answers = defaultPlanAnswers()
    answers.raceDate = '2027-12-20'
    const plan = generateTrainingPlan(answers, new Date('2026-09-20T12:00:00'))
    expect(plan.weeks).toHaveLength(24)
  })
})
