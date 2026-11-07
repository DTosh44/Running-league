import { describe, expect, it } from 'vitest'
import { reconcileScreenshots, validateEvidenceFiles } from './verified-evidence'
import type { ScreenshotMetrics } from './screenshot-import'

const metrics = (values: Partial<ScreenshotMetrics>): ScreenshotMetrics => ({
  distanceKm: null, elevationM: null, elapsedSeconds: null, movingSeconds: null, ...values,
})

describe('verified screenshot reconciliation', () => {
  it('combines an overview and a details screenshot without substituting moving time', () => {
    const result = reconcileScreenshots([
      metrics({ distanceKm: 5.01, elevationM: 32, movingSeconds: 1210 }),
      metrics({ elapsedSeconds: 1338, movingSeconds: 1210 }),
    ])
    expect(result.distanceKm).toBe(5.01)
    expect(result.elapsedSeconds).toBe(1338)
    expect(result.movingSeconds).toBe(1210)
    expect(result.recognisedElapsed).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('flags missing elapsed time so the organiser must verify it', () => {
    const result = reconcileScreenshots([metrics({ distanceKm: 10, movingSeconds: 2700 })])
    expect(result.elapsedSeconds).toBeNull()
    expect(result.warnings).toContain('Elapsed time not recognised: organiser must verify it visually')
  })

  it('flags contradictions between two screenshots', () => {
    const result = reconcileScreenshots([
      metrics({ distanceKm: 5.1, elapsedSeconds: 1500, elevationM: 40 }),
      metrics({ distanceKm: 6.2, elapsedSeconds: 1610, elevationM: 130 }),
    ])
    expect(result.warnings).toContain('Distance differs between screenshots')
    expect(result.warnings).toContain('Elevation gain differs between screenshots')
    expect(result.warnings).toContain('Elapsed time differs between screenshots')
  })

  it('highlights suspicious moving-versus-elapsed anomalies', () => {
    expect(reconcileScreenshots([metrics({ distanceKm: 5, elapsedSeconds: 1400, movingSeconds: 1900 })]).warnings)
      .toContain('Moving time is greater than elapsed time')
    expect(reconcileScreenshots([metrics({ distanceKm: 5, elapsedSeconds: 3000, movingSeconds: 1200 })]).warnings)
      .toContain('More than 20 minutes stopped: organiser should check the activity')
  })

  it('rejects duplicate or oversized screenshot selections', () => {
    const image = new File(['evidence'], 'same.png', { type: 'image/png' })
    expect(() => validateEvidenceFiles([image, image])).toThrow(/identical/)
    expect(() => validateEvidenceFiles([])).toThrow(/one or two/)
    expect(() => validateEvidenceFiles([image, image, image])).toThrow(/one or two/)
    expect(() => validateEvidenceFiles([new File(['image'], 'run.heic', { type: 'image/heic' })])).toThrow(/PNG, JPG or WebP/)
  })
})
