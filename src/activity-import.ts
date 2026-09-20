import type { ActivityRecord } from './types'

export type ImportedActivity = {
  name: string
  occurredAt: string
  location: string
  source: ActivityRecord['source']
  distanceKm: number
  elevationM: number
  elapsedSeconds: number
}

const radians = (degrees: number) => degrees * Math.PI / 180

const distanceMetres = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const earthRadius = 6_371_000
  const dLat = radians(b.lat - a.lat)
  const dLon = radians(b.lon - a.lon)
  const lat1 = radians(a.lat)
  const lat2 = radians(b.lat)
  const value = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function parseGpx(text: string, filename: string): ImportedActivity {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('This GPX file is not valid XML.')
  const points = Array.from(document.querySelectorAll('trkpt')).map((point) => ({
    lat: Number(point.getAttribute('lat') ?? NaN),
    lon: Number(point.getAttribute('lon') ?? NaN),
    elevation: Number(point.querySelector('ele')?.textContent || 0),
    time: point.querySelector('time')?.textContent || '',
    segment: point.parentElement,
  })).filter((point) => Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180)
  if (points.length < 2) throw new Error('The GPX file does not contain enough track points.')
  let distance = 0
  let ascent = 0
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].segment !== points[index - 1].segment) continue
    distance += distanceMetres(points[index - 1], points[index])
    const climb = points[index].elevation - points[index - 1].elevation
    if (Number.isFinite(climb) && climb > 0) ascent += climb
  }
  const firstTime = Date.parse(points[0].time)
  const lastTime = Date.parse(points.at(-1)?.time || '')
  if (!Number.isFinite(firstTime) || !Number.isFinite(lastTime) || lastTime <= firstTime) throw new Error('The GPX file must contain valid start and finish times.')
  const title = document.querySelector('trk > name')?.textContent?.trim() || filename.replace(/\.gpx$/i, '')
  return {
    name: title || 'Imported GPX run',
    occurredAt: new Date(firstTime).toISOString(),
    location: 'GPX route',
    source: 'GPX upload',
    distanceKm: Math.round(distance) / 1000,
    elevationM: Math.round(ascent),
    elapsedSeconds: Math.max(1, Math.round((lastTime - firstTime) / 1000)),
  }
}

async function parseFit(buffer: ArrayBuffer, filename: string): Promise<ImportedActivity> {
  const { default: FitParser } = await import('fit-file-parser')
  const parser = new FitParser({ mode: 'list', lengthUnit: 'm' })
  const result = await parser.parseAsync(buffer)
  const session = result.sessions?.find((item) => item.sport === 'running')
  if (!session?.total_distance || !session.total_elapsed_time || !session.start_time) throw new Error('No complete running session was found in this FIT file.')
  return {
    name: filename.replace(/\.fit$/i, '') || 'Imported FIT run',
    occurredAt: session.start_time.toISOString(),
    location: 'FIT activity',
    source: 'FIT upload',
    distanceKm: Math.round(session.total_distance) / 1000,
    elevationM: Math.max(0, Math.round(session.total_ascent ?? 0)),
    elapsedSeconds: Math.max(1, Math.round(session.total_elapsed_time)),
  }
}

export async function importActivityFile(file: File): Promise<ImportedActivity> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an activity file smaller than 20 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'gpx') return parseGpx(await file.text(), file.name)
  if (extension === 'fit') return parseFit(await file.arrayBuffer(), file.name)
  throw new Error('Choose a .gpx or .fit activity file.')
}
