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
