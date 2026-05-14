'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { StatsResponse } from '@/lib/types'
import { Header } from './Header'
import { StatCounters } from './StatCounters'
import { TrendChart } from './TrendChart'
import { TopRulesChart } from './TopRulesChart'
import { AlertsTable } from './AlertsTable'
import { TopIocsTable } from './TopIocsTable'
import { WorkflowCards } from './WorkflowCards'

interface DashboardShellProps {
  initialData: StatsResponse
}

export function DashboardShell({ initialData }: DashboardShellProps) {
  const [data, setData] = useState<StatsResponse>(initialData)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const router = useRouter()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) return
      const json = (await res.json()) as StatsResponse
      setData(json)
      setLastUpdate(new Date())
    } catch {
      // silently fail — stale data stays, timestamp stops updating
    }
  }, [router])

  useEffect(() => {
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header lastUpdate={lastUpdate} onLogout={logout} />

      <main className="p-4 space-y-4">
        {/* Row 1: stat counters (full width) */}
        <StatCounters counters={data.counters} />

        {/* Row 2: trend chart + top rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrendChart trend={data.trend} />
          <TopRulesChart rules={data.top_rules} />
        </div>

        {/* Row 3: workflow cards + top IOCs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WorkflowCards workflows={data.workflows} />
          <TopIocsTable iocs={data.top_iocs} />
        </div>

        {/* Row 4: alerts table (full width) */}
        <AlertsTable alerts={data.recent_alerts} />
      </main>
    </div>
  )
}
