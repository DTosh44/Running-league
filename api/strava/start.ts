import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { appUrl, authenticatedUser, stravaClientId } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  try {
    const { user, client } = await authenticatedUser(req)
    const state = randomBytes(24).toString('hex')
    const { error } = await client.from('oauth_states').insert({ state, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() })
    if (error) throw error
    const callback = `${appUrl()}/api/strava/callback`
    const url = new URL('https://www.strava.com/oauth/authorize')
    url.searchParams.set('client_id', stravaClientId())
    url.searchParams.set('redirect_uri', callback)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('approval_prompt', 'auto')
    url.searchParams.set('scope', 'read,activity:read')
    url.searchParams.set('state', state)
    return res.status(200).json({ url: url.toString() })
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Strava connection could not be started.' })
  }
}
