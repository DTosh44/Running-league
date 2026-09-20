import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticatedUser } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const { user, client } = await authenticatedUser(req)
    const { data, error } = await client.from('provider_connections').select('provider').eq('user_id', user.id).eq('provider', 'strava').maybeSingle()
    if (error) throw error
    return res.status(200).json({ connected: Boolean(data), available: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) })
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'Unauthorised.' })
  }
}
