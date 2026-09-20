import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function getAccessToken() {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
  return data.session?.access_token ?? null
}
