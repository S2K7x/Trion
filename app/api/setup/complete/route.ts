import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { encryptValue } from '@/lib/config-crypto'

const UNENCRYPTED_KEYS = new Set(['setup_complete', 'malwarebazaar_enabled'])

/** Unprotected: only accepts writes when setup_complete = 'false'. */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase()

  // Guard: refuse if setup is already complete
  const { data: existing } = await supabase
    .from('trion_config')
    .select('value')
    .eq('key', 'setup_complete')
    .single()

  if (existing?.value === 'true') {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 })
  }

  const config: Record<string, string> = await request.json()

  const rows = Object.entries(config).map(([key, value]) => ({
    key,
    value: UNENCRYPTED_KEYS.has(key) ? value : encryptValue(value),
    updated_at: new Date().toISOString(),
  }))

  // Batch upsert — atomic: all succeed or none are written
  const { error } = await supabase
    .from('trion_config')
    .upsert(rows, { onConflict: 'key' })

  if (error) {
    console.error('[trion] setup/complete DB error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
