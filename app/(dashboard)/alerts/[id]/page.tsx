import { notFound } from 'next/navigation'
import { getAlertById, getSimilarAlerts } from '@/lib/queries'
import AlertDetail from './AlertDetail'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

export default async function AlertDetailPage({ params }: PageProps) {
  const alert = await getAlertById(params.id)
  if (!alert) notFound()

  const similar = await getSimilarAlerts(alert.rule_id ?? '', String(alert.id))

  return <AlertDetail alert={alert} similar={similar} />
}
