'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { StatsResponse } from '@/lib/types'
import { StatCounters } from './StatCounters'
import { TrendChart } from './TrendChart'
import { TopRulesChart } from './TopRulesChart'
import { AlertsTable } from './AlertsTable'
import { TopIocsTable } from './TopIocsTable'
import { WorkflowCards } from './WorkflowCards'
import { ChatButton } from './ChatButton'
import { ChatPanel } from './ChatPanel'

interface DashboardShellProps {
  initialData: StatsResponse
}

export function DashboardShell({ initialData }: DashboardShellProps) {
  const [data, setData] = useState<StatsResponse>(initialData)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [secsAgo, setSecsAgo] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
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

  useEffect(() => {
    setSecsAgo(0)
    const t = setInterval(() => setSecsAgo((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [lastUpdate])

  return (
    <main
      className="overflow-y-auto flex flex-col gap-6 px-8 py-7"
      style={{ background: 'var(--bg)' }}
    >
      <div className="fade-up-1 flex items-start justify-between">
        <div>
          <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Security Overview
          </div>
          <div className="font-mono text-[12px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
            Updated {secsAgo}s ago · refreshes automatically
            {secsAgo > 90 && (
              <span
                className="font-mono text-[10px] px-1.5 py-px rounded"
                style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}
              >
                stale
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="fade-up-2">
        <StatCounters counters={data.counters} />
      </div>

      <div className="fade-up-3 grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        <AlertsTable alerts={data.recent_alerts} />
        <div className="flex flex-col gap-4">
          <TrendChart trend={data.trend} />
          <TopIocsTable iocs={data.top_iocs} />
          <WorkflowCards workflows={data.workflows} />
        </div>
      </div>

      <div className="fade-up-4">
        <TopRulesChart rules={data.top_rules} />
      </div>

      <ChatButton onClick={() => setChatOpen(true)} />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        mode="generic"
      />
    </main>
  )
}
