import type { ScreenshotMetrics } from './screenshot-import'

export type ScreenshotReview = ScreenshotMetrics & {
  warnings: string[]
  recognisedElapsed: boolean
}

export function reconcileScreenshots(screenshots: ScreenshotMetrics[]): ScreenshotReview {
  if (!screenshots.length || screenshots.length > 2) throw new Error('Choose one or two Strava screenshots.')
  const warnings: string[] = []
  const first = <K extends keyof ScreenshotMetrics>(key: K) =>
    screenshots.find((image) => image[key] !== null)?.[key] ?? null

  const distanceKm = first('distanceKm')
  const elevationM = first('elevationM')
  const elapsedSeconds = first('elapsedSeconds')
  const movingSeconds = first('movingSeconds')

  function flagConflict(key: keyof ScreenshotMetrics, tolerance: number, label: string) {
    const values = screenshots.map((item) => item[key]).filter((value): value is number => value !== null)
    if (values.length >= 2 && Math.max(...values) - Math.min(...values) > tolerance) {
      warnings.push(label + ' differs between screenshots')
    }
  }
  flagConflict('distanceKm', 0.06, 'Distance')
  flagConflict('elevationM', 10, 'Elevation gain')
  flagConflict('elapsedSeconds', 5, 'Elapsed time')
  flagConflict('movingSeconds', 5, 'Moving time')

  if (elapsedSeconds === null) warnings.push('Elapsed time not recognised: organiser must verify it visually')
  if (distanceKm === null) warnings.push('Distance not recognised: organiser must verify it visually')
  if (elapsedSeconds !== null && movingSeconds !== null && movingSeconds > elapsedSeconds + 5) {
    warnings.push('Moving time is greater than elapsed time')
  }
  if (elapsedSeconds !== null && movingSeconds !== null && elapsedSeconds - movingSeconds > 20 * 60) {
    warnings.push('More than 20 minutes stopped: organiser should check the activity')
  }
  return { distanceKm, elevationM, elapsedSeconds, movingSeconds, recognisedElapsed: elapsedSeconds !== null, warnings }
}

// Keep a single 6 MB cap in the client and the private Supabase bucket.
export const MAX_EVIDENCE_BYTES = 6 * 1024 * 1024

export function validateEvidenceFile(file: File): 'jpg' | 'png' | 'webp' {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeForExtension: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  }
  if (!extension || !mimeForExtension[extension] || (file.type && file.type !== mimeForExtension[extension])) {
    throw new Error('Choose a PNG, JPG or WebP Strava screenshot.')
  }
  if (!file.size || file.size > MAX_EVIDENCE_BYTES) {
    throw new Error('Each original screenshot must be smaller than 6 MB.')
  }
  return extension === 'jpeg' ? 'jpg' : extension as 'jpg' | 'png' | 'webp'
}

export function validateEvidenceFiles(files: File[]): void {
  if (files.length < 1 || files.length > 2) throw new Error('Choose one or two Strava screenshots.')
  files.forEach(validateEvidenceFile)
  if (files.length === 2 &&
      files[0].name === files[1].name &&
      files[0].size === files[1].size &&
      files[0].lastModified === files[1].lastModified) {
    throw new Error('The two screenshots appear identical. Add a different details screen.')
  }
}
