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
        sub="security events in the last 24h"
        color="var(--accent)"
        orb="blue"
        tooltip="Total number of security events detected across all monitored systems in the past 24 hours."
      />
      <StatCard
        label="Awaiting Review"
        value={counters.queue_depth}
        sub="not yet processed"
        color="var(--yellow)"
        orb="yellow"
        tooltip="Alerts received but not yet analyzed. A high number may mean the automation pipeline is backed up."
      />
      <StatCard
        label="High Severity"
        value={counters.critical}
        sub="require immediate attention"
        color="var(--red)"
        orb="red"
        tooltip="Alerts rated High or Critical in the past 24 hours. These should be reviewed as soon as possible."
      />
      <StatCard
        label="Processing Errors"
        value={errorRateDisplay}
        sub={errorHigh ? 'above normal — check workflows' : 'within normal range'}
        color={errorHigh ? 'var(--red)' : 'var(--green)'}
        orb={errorHigh ? 'red' : 'green'}
        tooltip="Percentage of alerts that failed to process correctly. Above 5% may indicate a problem with the automation pipeline."
      />
    </div>
  )
}
