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
  const [secsAgo, setSecsAgo] = useState(0)
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

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }, [router])

  const pending = data.counters.queue_depth

  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: '220px 1fr',
        gridTemplateRows: '56px 1fr',
        background: 'var(--bg)',
      }}
    >
      {/* Topbar — spans full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Header lastUpdate={lastUpdate} onLogout={logout} />
      </div>

      {/* Sidebar */}
      <nav
        className="flex flex-col gap-1 px-3 py-5 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <NavSection label="Monitor" />

        <NavItem active icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5"/>
          </svg>
        }>
          Overview
        </NavItem>

        <NavItem badge={pending > 0 ? pending : undefined} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h8M2 12h10"/>
          </svg>
        }>
          Alert Queue
        </NavItem>

        <NavItem icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/>
          </svg>
        }>
          Timeline
        </NavItem>

        <NavSection label="Threat Intel" />

        <NavItem icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z"/>
          </svg>
        }>
          IOCs
        </NavItem>

        <NavItem icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4"/><path d="M10 10l4 4"/>
          </svg>
        }>
          Reputation
        </NavItem>

        <NavSection label="System" />

        <NavItem icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/><circle cx="8" cy="8" r="3"/>
          </svg>
        }>
          Workflows
        </NavItem>

        <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <NavItem icon={
            <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
          }>
            demo
          </NavItem>
        </div>
      </nav>

      {/* Main */}
      <main
        className="overflow-y-auto flex flex-col gap-6 px-8 py-7"
        style={{ background: 'var(--bg)' }}
      >
        {/* Page header */}
        <div className="fade-up-1 flex items-start justify-between">
          <div>
            <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Overview
            </div>
            <div className="font-mono text-[12px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              Last sync · {secsAgo}s ago · polling every 30s
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

        {/* Stat counters */}
        <div className="fade-up-2">
          <StatCounters counters={data.counters} />
        </div>

        {/* Alert table + side column */}
        <div className="fade-up-3 grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
          <AlertsTable alerts={data.recent_alerts} />

          <div className="flex flex-col gap-4">
            <TrendChart trend={data.trend} />
            <TopIocsTable iocs={data.top_iocs} />
            <WorkflowCards workflows={data.workflows} />
          </div>
        </div>

        {/* Top rules */}
        <div className="fade-up-4">
          <TopRulesChart rules={data.top_rules} />
        </div>
      </main>
    </div>
  )
}

function NavSection({ label }: { label: string }) {
  return (
    <div
      className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase px-2 pt-3 pb-1.5"
      style={{ color: 'var(--muted)' }}
    >
      {label}
    </div>
  )
}

function NavItem({
  children,
  active,
  badge,
  icon,
}: {
  children: React.ReactNode
  active?: boolean
  badge?: number
  icon: React.ReactNode
}) {
  return (
    <div
      className={`relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
        active ? '' : 'hover:bg-[#161b22] hover:text-[#e6edf3]'
      }`}
      style={
        active
          ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
          : { color: 'var(--muted)' }
      }
    >
      {active && <span className="nav-active" />}
      {icon}
      {children}
      {badge !== undefined && (
        <span
          className="ml-auto font-mono text-[10px] font-medium px-1.5 py-px rounded-full"
          style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
