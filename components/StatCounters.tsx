import type { DashboardCounters } from '@/lib/types'

interface StatCountersProps {
  counters: DashboardCounters
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  accentColor: string
}

function StatCard({ label, value, sub, accentColor }: StatCardProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded p-4">
      <div className="text-[#555555] text-xs font-mono uppercase tracking-widest mb-2">{label}</div>
      <div className="text-2xl font-mono font-bold mb-1" style={{ color: accentColor }}>
        {value}
      </div>
      <div className="text-[#555555] text-xs font-mono">{sub}</div>
    </div>
  )
}

export function StatCounters({ counters }: StatCountersProps) {
  const errorRateDisplay =
    counters.error_rate != null ? `${Number(counters.error_rate).toFixed(1)}%` : '0.0%'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="alerts today"
        value={counters.today}
        sub="last 24h"
        accentColor="#3b82f6"
      />
      <StatCard
        label="queue depth"
        value={counters.queue_depth}
        sub="pending"
        accentColor="#eab308"
      />
      <StatCard
        label="critical (24h)"
        value={counters.critical}
        sub="rule_level ≥ 12"
        accentColor="#ef4444"
      />
      <StatCard
        label="error rate"
        value={errorRateDisplay}
        sub="status = error"
        accentColor={Number(counters.error_rate) > 5 ? '#ef4444' : '#22c55e'}
      />
    </div>
  )
}
