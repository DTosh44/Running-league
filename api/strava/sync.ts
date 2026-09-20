import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser, importStravaActivities, validStravaConnection } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const { user } = await authenticatedUser(req)
    const connection = await validStravaConnection(user.id)
    const imported = await importStravaActivities(user.id, connection.access_token, Math.floor(Date.now() / 1000) - 90 * 86400)
    return res.status(200).json({ imported })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Strava sync failed.' })
  }
}
