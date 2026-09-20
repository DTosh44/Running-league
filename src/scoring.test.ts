import { describe, expect, it } from 'vitest'
import { calculateRunScore, scoreBand, scoringConfig } from './scoring'

describe('RunningScore v1.0', () => {
  it('awards 20 points for the 20:21 5K benchmark', () => {
    const score = calculateRunScore({
      distanceKm: 5,
      elevationM: 0,
      elapsedSeconds: scoringConfig.benchmarkTimeSeconds,
    })

    expect(score.performanceIndex).toBeCloseTo(100, 5)
    expect(score.points).toBe(20)
    expect(score.band).toBe('Strong')
  })

  it('adds climbing to effort distance', () => {
    const flat = calculateRunScore({ distanceKm: 8, elevationM: 0, elapsedSeconds: 2700 })
    const hilly = calculateRunScore({ distanceKm: 8, elevationM: 200, elapsedSeconds: 2700 })

    expect(hilly.effortDistanceKm).toBe(10)
    expect(hilly.points).toBeGreaterThan(flat.points)
  })

  it('recognises interval effort without removing recovery time', () => {
    const score = calculateRunScore({
      distanceKm: 5,
      elevationM: 0,
      elapsedSeconds: 1800,
      paceBlocks: [
        { seconds: 900, speedMps: 5 },
        { seconds: 900, speedMps: 2.1 },
      ],
    })

    expect(score.intervalUplift).toBeGreaterThan(0)
    expect(score.points).toBeLessThanOrEqual(25)
  })

  it('flags short activities for eligibility review', () => {
    const score = calculateRunScore({ distanceKm: 1.5, elevationM: 0, elapsedSeconds: 420 })
    expect(score.reviewNote).toMatch(/Under 2 km/)
  })

  it('uses the agreed score bands', () => {
    expect(scoreBand(5)).toBe('Gentle')
    expect(scoreBand(10)).toBe('Easy')
    expect(scoreBand(15)).toBe('Solid')
    expect(scoreBand(20)).toBe('Strong')
    expect(scoreBand(24)).toBe('Outstanding')
    expect(scoreBand(25)).toBe('Peak performance')
  })
})

describe('weekly league selection', () => {
  it('uses the UK week, excludes future and training runs, and counts one run per day', async () => {
    const { weeklyScoringRuns } = await import('./scoring')
    const run = (id: string, occurredAt: string, points: number, training = false) => ({ id, occurredAt, score: { points }, training })
    const chosen = weeklyScoringRuns([
      run('old', '2026-09-13T22:59:00Z', 25),
      run('monday', '2026-09-13T23:01:00Z', 20),
      run('same-day', '2026-09-14T08:00:00Z', 22),
      run('tuesday', '2026-09-15T08:00:00Z', 18),
      run('training', '2026-09-16T08:00:00Z', 25, true),
      run('future', '2026-09-21T08:00:00Z', 25),
    ], 3, new Date('2026-09-20T12:00:00Z'))
    expect(chosen.map((run) => run.id)).toEqual(['same-day', 'tuesday'])
  })
})
