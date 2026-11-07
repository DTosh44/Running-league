// Browser-only screenshot recognition. No screenshot is uploaded or stored by RunningLeague.
// OCR assets are fetched from a pinned, freely available Tesseract.js CDN build.
export type ScreenshotMetrics = {
  distanceKm: number | null
  elevationM: number | null
  elapsedSeconds: number | null
  movingSeconds: number | null
}

type OcrEvent = { status?: string; progress?: number }
type OcrWorker = {
  recognize: (image: File) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}
type TesseractLibrary = {
  createWorker: (language: string, oem?: number, options?: { logger?: (event: OcrEvent) => void }) => Promise<OcrWorker>
}
type OcrWindow = Window & { Tesseract?: TesseractLibrary }

const OCR_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js'
let loadingLibrary: Promise<TesseractLibrary> | null = null

function loadLibrary(): Promise<TesseractLibrary> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Screenshot recognition is only available in a browser.'))
  const browser = window as OcrWindow
  if (browser.Tesseract) return Promise.resolve(browser.Tesseract)
  if (!loadingLibrary) {
    loadingLibrary = new Promise<TesseractLibrary>((resolve, reject) => {
      const script = document.createElement('script')
      script.async = true
      script.src = OCR_SCRIPT_URL
      script.onload = () => browser.Tesseract
        ? resolve(browser.Tesseract)
        : reject(new Error('The screenshot reader could not start. Enter your run details manually.'))
      script.onerror = () => {
        script.remove()
        reject(new Error('The free screenshot reader could not download. Check your connection or enter the details manually.'))
      }
      document.head.appendChild(script)
    }).catch((error: unknown) => {
      loadingLibrary = null
      throw error
    })
  }
  return loadingLibrary
}

function matchNearLabel(lines: string[], label: RegExp, value: RegExp, allowPrevious = false): RegExpMatchArray | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (!label.test(lines[index])) continue
    const next = lines[index + 1] ?? ''
    // Do not borrow an unrelated time from the next labelled metric.
    const candidates = [lines[index].replace(label, ' ')]
    if (allowPrevious || !/\b(moving|pace|distance|elevation)\b/i.test(next)) candidates.push(next)
    if (allowPrevious) candidates.push(lines[index - 1] ?? '')
    for (const candidate of candidates) {
      const match = candidate.match(value)
      if (match) return match
    }
  }
  return null
}

function readClock(value?: string): number | null {
  if (!value) return null
  const parts = value.split(':').map(Number)
  if (parts.length !== 2 && parts.length !== 3) return null
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) return null
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]]
  if (minutes > 59 || seconds > 59) return null
  const total = hours * 3600 + minutes * 60 + seconds
  return total > 0 ? total : null
}

export function formatScreenshotTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const whole = Math.round(seconds)
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

export function parseStravaScreenshotText(text: string): ScreenshotMetrics {
  const lines = text.replace(/\u00a0/g, ' ').replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean)
  const distancePattern = /(\d{1,3}(?:[.,]\d{1,3})?)\s*(km|kms|mi|miles)\b/i
  const elevationPattern = /(\d{1,5}(?:[.,]\d{1,2})?)\s*(m|metres|meters|ft|feet)\b/i
  const clockPattern = /\b(\d{1,3}:\d{2}(?::\d{2})?)\b/
  const distanceMatch = matchNearLabel(lines, /\bdistance\b/i, distancePattern, true)
    ?? lines.map((line) => line.match(distancePattern)).find(Boolean)
  const elevationMatch = matchNearLabel(lines, /\b(?:elevation(?: gain)?|total ascent|elev\.? gain)\b/i, elevationPattern, true)
  const elapsedMatch = matchNearLabel(lines, /\belapsed\s+time\b/i, clockPattern)
  const movingMatch = matchNearLabel(lines, /\bmoving(?:\s+time)?\b/i, clockPattern)

  const distanceNumber = distanceMatch ? Number(distanceMatch[1].replace(',', '.')) : NaN
  const distanceKm = Number.isFinite(distanceNumber) && distanceNumber > 0 && distanceNumber <= 500
    ? Math.round(distanceNumber * (/^(mi|miles)$/i.test(distanceMatch?.[2] ?? '') ? 1.609344 : 1) * 1000) / 1000
    : null
  const elevationNumber = elevationMatch ? Number(elevationMatch[1].replace(',', '.')) : NaN
  const elevationM = Number.isFinite(elevationNumber) && elevationNumber >= 0 && elevationNumber <= 20000
    ? Math.round(elevationNumber * (/^(ft|feet)$/i.test(elevationMatch?.[2] ?? '') ? 0.3048 : 1))
    : null

  // Strava's default "Moving Time" is not the elapsed time used by RunningScore.
  // Never infer elapsed time from pace, an unlabelled clock value or moving time.
  return {
    distanceKm,
    elevationM,
    elapsedSeconds: readClock(elapsedMatch?.[1]),
    movingSeconds: readClock(movingMatch?.[1]),
  }
}

export async function readStravaScreenshot(file: File, onProgress?: (percent: number) => void): Promise<ScreenshotMetrics> {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) || !['image/png', 'image/jpeg', 'image/webp', ''].includes(file.type)) {
    throw new Error('Use a PNG, JPG or WebP screenshot. Convert HEIC images first.')
  }
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error('Choose a screenshot smaller than 12 MB.')
  const tesseract = await loadLibrary()
  const worker = await tesseract.createWorker('eng', 1, {
    logger: (event) => {
      if (event.status === 'recognizing text' && typeof event.progress === 'number') {
        onProgress?.(Math.round(Math.max(0, Math.min(1, event.progress)) * 100))
      }
    },
  })
  try {
    const result = await worker.recognize(file)
    return parseStravaScreenshotText(result.data.text)
  } finally {
    await worker.terminate()
  }
}
