import type { DashboardCounters } from '@/lib/types'

interface StatCountersProps {
  counters: DashboardCounters
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  accentColor: string
  orbClass: string
}

function StatCard({ label, value, sub, accentColor, orbClass }: StatCardProps) {
  return (
    <div
      className={`stat-orb ${orbClass} relative rounded-[12px] p-5 border transition-all duration-200 hover:border-[rgba(255,255,255,0.10)]`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="text-[11px] font-semibold tracking-[0.06em] uppercase mb-2.5"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </div>
      <div
        className="text-[28px] font-bold leading-none"
        style={{ color: accentColor, letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <div className="font-mono text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
        {sub}
      </div>
    </div>
  )
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
        accentColor="var(--accent)"
        orbClass="stat-orb-blue"
      />
      <StatCard
        label="Pending"
        value={counters.queue_depth}
        sub="queue depth"
        accentColor="var(--yellow)"
        orbClass="stat-orb-yellow"
      />
      <StatCard
        label="Critical (24h)"
        value={counters.critical}
        sub="rule level ≥ 12"
        accentColor="var(--red)"
        orbClass="stat-orb-red"
      />
      <StatCard
        label="Error Rate"
        value={errorRateDisplay}
        sub="status = error"
        accentColor={errorHigh ? 'var(--red)' : 'var(--green)'}
        orbClass={errorHigh ? 'stat-orb-red' : 'stat-orb-green'}
      />
    </div>
  )
}
