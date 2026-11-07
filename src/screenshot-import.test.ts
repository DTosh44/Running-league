import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatScreenshotTime, parseStravaScreenshotText, readStravaScreenshot } from './screenshot-import'

describe('Strava screenshot text extraction', () => {
  it('extracts labelled distance, elevation and elapsed time', () => {
    const result = parseStravaScreenshotText([
      'Morning Run', 'Distance', '5.02 km', 'Elapsed Time', '00:24:18',
      'Moving Time', '24:10', 'Avg Pace', '4:49 /km', 'Elevation Gain', '36 m',
    ].join('\n'))
    expect(result).toEqual({
      distanceKm: 5.02,
      elevationM: 36,
      elapsedSeconds: 1458,
      movingSeconds: 1450,
    })
  })

  it('never mistakes moving time or pace for elapsed time', () => {
    const result = parseStravaScreenshotText('Distance 10.01 km\nMoving Time 52:15\nAvg Pace 5:13 /km\nElevation Gain 88 m')
    expect(result.distanceKm).toBe(10.01)
    expect(result.movingSeconds).toBe(3135)
    expect(result.elapsedSeconds).toBeNull()
  })

  it('handles values above labels and unit conversions', () => {
    const result = parseStravaScreenshotText('3.11 mi\nDistance\nElapsed Time 25:00\nElevation Gain 164 ft')
    expect(result.distanceKm).toBeCloseTo(5.005, 3)
    expect(result.elevationM).toBe(50)
    expect(result.elapsedSeconds).toBe(1500)
  })

  it('does not fill missing fields with invented numbers', () => {
    expect(parseStravaScreenshotText('Afternoon Run\nAverage Pace 4:05 /km\nNice weather')).toEqual({
      distanceKm: null, elevationM: null, elapsedSeconds: null, movingSeconds: null,
    })
  })

  it('formats elapsed time for user verification', () => {
    expect(formatScreenshotTime(1500)).toBe('00:25:00')
    expect(formatScreenshotTime(3731)).toBe('01:02:11')
    expect(formatScreenshotTime(0)).toBe('')
  })
})

describe('local OCR lifecycle', () => {
  afterEach(() => {
    delete (window as Window & { Tesseract?: unknown }).Tesseract
  })

  it('processes the screenshot in the browser and terminates the worker', async () => {
    const terminate = vi.fn(async () => undefined)
    const recognize = vi.fn(async () => ({ data: { text: 'Distance 5 km\nElapsed Time 25:00\nElevation Gain 0 m' } }))
    const createWorker = vi.fn(async () => ({ recognize, terminate }))
    Object.assign(window, { Tesseract: { createWorker } })
    const file = new File(['image'], 'run.png', { type: 'image/png' })
    const result = await readStravaScreenshot(file)
    expect(result).toEqual({ distanceKm: 5, elevationM: 0, elapsedSeconds: 1500, movingSeconds: null })
    expect(recognize).toHaveBeenCalledWith(file)
    expect(terminate).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported image formats before running OCR', async () => {
    await expect(readStravaScreenshot(new File(['image'], 'run.heic', { type: 'image/heic' })))
      .rejects.toThrow(/PNG, JPG or WebP/)
  })
})
