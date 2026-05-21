import type { ReactNode } from 'react'
import { getQueueDepth } from '@/lib/queries'
import { AppShellClient } from '@/components/AppShellClient'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const pending = await getQueueDepth()
  return <AppShellClient pending={pending}>{children}</AppShellClient>
}
