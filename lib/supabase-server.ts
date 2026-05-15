import { createClient } from '@supabase/supabase-js'

export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set'
    )
  }

  return createClient(url, key, { auth: { persistSession: false } })
}
