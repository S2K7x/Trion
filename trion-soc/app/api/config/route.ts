import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerSupabase } from '@/lib/supabase-server'
import { encryptValue, decryptValue } from '@/lib/config-crypto'

const UNENCRYPTED_KEYS = new Set(['setup_complete', 'malwarebazaar_enabled'])

const ALLOWED_KEYS = new Set([
  'supabase_url', 'supabase_service_key',
  'slack_webhook_url',
  'virustotal_api_key', 'abuseipdb_api_key', 'malwarebazaar_enabled',
  'llm_provider', 'llm_endpoint', 'llm_model', 'llm_api_key',
  'setup_complete',
])

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('dashboard_session')?.value
  if (!token) return false
  try {
    const secret = new TextEncoder().encode(process.env.DASHBOARD_SECRET!)
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('trion_config')
    .select('key, value, updated_at')

  if (error) {
    console.error('[trion] config GET DB error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const config: Record<string, string> = {}
  for (const row of data ?? []) {
    if (UNENCRYPTED_KEYS.has(row.key)) {
      config[row.key] = row.value
    } else {
      try {
        config[row.key] = decryptValue(row.value)
      } catch {
        config[row.key] = ''
      }
    }
  }

  return NextResponse.json(config)
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { key, value } = body as { key: string; value: string }

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
  }

  if (!ALLOWED_KEYS.has(key)) {
    return NextResponse.json({ error: 'Invalid config key' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const storedValue = UNENCRYPTED_KEYS.has(key) ? value : encryptValue(value)

  const { error } = await supabase
    .from('trion_config')
    .upsert({ key, value: storedValue, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    console.error('[trion] config POST DB error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
