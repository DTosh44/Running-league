import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminClient, appUrl, importStravaActivities, stravaClientId, stravaClientSecret } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const finish = (status: string) => res.redirect(302, `${appUrl()}/app/profile?strava=${status}`)
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code || !state) return finish('cancelled')
    const client = adminClient()
    const { data: oauthState, error: stateError } = await client.from('oauth_states').delete().eq('state', state).gt('expires_at', new Date().toISOString()).select('*').maybeSingle()
    if (stateError || !oauthState) return finish('invalid')
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: stravaClientId(), client_secret: stravaClientSecret(), code, grant_type: 'authorization_code' }),
    })
    if (!response.ok) return finish('error')
    const token = await response.json()
    const { error: saveError } = await client.from('provider_connections').upsert({
      user_id: oauthState.user_id,
      provider: 'strava',
      external_user_id: String(token.athlete.id),
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      updated_at: new Date().toISOString(),
    })
    if (saveError) throw saveError
    await importStravaActivities(oauthState.user_id, token.access_token, Math.floor(Date.now() / 1000) - 90 * 86400)
    return finish('connected')
  } catch {
    return finish('error')
  }
}
