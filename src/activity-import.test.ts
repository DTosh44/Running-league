import { describe, expect, it } from 'vitest'
import { FitBaseType, FitEncoder } from 'fit-file-parser'
import { importActivityFile } from './activity-import'

describe('activity file imports', () => {
  it('extracts distance, time and climbing from GPX tracks', async () => {
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Canal 5K</name><trkseg>
      <trkpt lat="52.1900" lon="-1.7100"><ele>40</ele><time>2026-09-20T08:00:00Z</time></trkpt>
      <trkpt lat="52.2000" lon="-1.7000"><ele>58</ele><time>2026-09-20T08:10:00Z</time></trkpt>
      <trkpt lat="52.2100" lon="-1.6900"><ele>52</ele><time>2026-09-20T08:20:00Z</time></trkpt>
    </trkseg></trk></gpx>`
    const result = await importActivityFile(new File([gpx], 'canal.gpx', { type: 'application/gpx+xml' }))
    expect(result.name).toBe('Canal 5K')
    expect(result.source).toBe('GPX upload')
    expect(result.distanceKm).toBeGreaterThan(2)
    expect(result.elevationM).toBe(18)
    expect(result.elapsedSeconds).toBe(1200)
  })

  it('extracts a running session from FIT files', async () => {
    const encoder = new FitEncoder()
    encoder.writeMessage(18, [
      { number: 2, size: 4, baseType: FitBaseType.Uint32, value: FitEncoder.toFitTimestamp(new Date('2026-09-20T08:00:00Z')) },
      { number: 5, size: 1, baseType: FitBaseType.Enum, value: 1 },
      { number: 7, size: 4, baseType: FitBaseType.Uint32, value: 1_800_000 },
      { number: 9, size: 4, baseType: FitBaseType.Uint32, value: 500_000 },
      { number: 22, size: 2, baseType: FitBaseType.Uint16, value: 75 },
    ])
    const bytes = encoder.close()
    const fitBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const result = await importActivityFile(new File([fitBuffer], 'morning.fit', { type: 'application/octet-stream' }))
    expect(result.name).toBe('morning')
    expect(result.source).toBe('FIT upload')
    expect(result.distanceKm).toBe(5)
    expect(result.elevationM).toBe(75)
    expect(result.elapsedSeconds).toBe(1800)
  })
})
