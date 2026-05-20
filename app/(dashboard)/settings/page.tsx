import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { jwtVerify } from 'jose'
import { createServerSupabase } from '@/lib/supabase-server'
import { decryptValue } from '@/lib/config-crypto'
import SettingsClient from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

const UNENCRYPTED_KEYS = new Set(['setup_complete', 'malwarebazaar_enabled'])

async function getConfig(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const token = cookieStore.get('dashboard_session')?.value
  if (!token) redirect('/login')

  try {
    const secret = new TextEncoder().encode(process.env.DASHBOARD_SECRET!)
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
  } catch {
    redirect('/login')
  }

  const supabase = createServerSupabase()
  const { data, error } = await supabase.from('trion_config').select('key, value')
  if (error) return {}

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
  return config
}

export default async function SettingsPage() {
  const config = await getConfig()
  return <SettingsClient config={config} />
}
