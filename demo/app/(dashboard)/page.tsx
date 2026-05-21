import { getDashboardStats } from '@/lib/queries'
import { DashboardShell } from '@/components/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const initialData = await getDashboardStats()
  return <DashboardShell initialData={initialData} />
}
