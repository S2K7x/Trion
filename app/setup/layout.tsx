import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function SetupLayout({ children }: { children: ReactNode }) {
  try {
    const { createServerSupabase } = await import('@/lib/supabase-server')
    const supabase = createServerSupabase()
    const { data } = await supabase
      .from('trion_config')
      .select('value')
      .eq('key', 'setup_complete')
      .single()

    if (data?.value === 'true') {
      redirect('/')
    }
  } catch {
    // DB unavailable or table not yet created — show wizard
  }

  return <>{children}</>
}
