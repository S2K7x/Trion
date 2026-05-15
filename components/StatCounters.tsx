import type { DashboardCounters } from '@/lib/types'
import { StatCard } from '@/components/primitives/StatCard'

interface StatCountersProps {
  counters: DashboardCounters
}

export function StatCounters({ counters }: StatCountersProps) {
  const errorRateDisplay =
    counters.error_rate != null ? `${Number(counters.error_rate).toFixed(1)}%` : '0.0%'
  const errorHigh = Number(counters.error_rate) > 5

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Alerts Today"
        value={counters.today}
        sub="↑ last 24h"
        color="var(--accent)"
        orb="blue"
      />
      <StatCard
        label="Pending"
        value={counters.queue_depth}
        sub="queue depth"
        color="var(--yellow)"
        orb="yellow"
      />
      <StatCard
        label="Critical (24h)"
        value={counters.critical}
        sub="rule level ≥ 12"
        color="var(--red)"
        orb="red"
      />
      <StatCard
        label="Error Rate"
        value={errorRateDisplay}
        sub="status = error"
        color={errorHigh ? 'var(--red)' : 'var(--green)'}
        orb={errorHigh ? 'red' : 'green'}
      />
    </div>
  )
}
