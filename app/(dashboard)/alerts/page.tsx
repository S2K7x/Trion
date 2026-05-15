import { Suspense } from 'react'
import { getAlertsPaginated } from '@/lib/queries'
import { AlertsTable } from '@/components/AlertsTable'
import { AlertFilters } from '@/components/AlertFilters'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function AlertsPage({ searchParams }: PageProps) {
  const opts = {
    severity: sp(searchParams.severity),
    status:   sp(searchParams.status),
    q:        sp(searchParams.q),
    range:    sp(searchParams.range),
    page:     Number(sp(searchParams.page) ?? 0),
    pageSize: 25,
  }

  const { alerts, total } = await getAlertsPaginated(opts)

  const initial = {
    severity: opts.severity,
    status:   opts.status,
    q:        opts.q,
    range:    opts.range,
  }

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1">
        <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Alert Queue
        </div>
        <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
          {total} alerts · {opts.range ?? '24h'} window
        </div>
      </div>

      <div className="fade-up-2">
        <Suspense>
          <AlertFilters initial={initial} />
        </Suspense>
      </div>

      <div className="fade-up-3">
        <AlertsTable alerts={alerts} />
      </div>
    </main>
  )
}
