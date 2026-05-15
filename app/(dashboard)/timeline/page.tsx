import Link from 'next/link'
import { getTimeline } from '@/lib/queries'
import type { AlertRecord } from '@/lib/types'
import { SevDot } from '@/components/primitives/SevDot'
import { SeverityChip } from '@/components/primitives/SeverityChip'
import { StatusBadge } from '@/components/primitives/StatusBadge'
import { IocPill } from '@/components/primitives/IocPill'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function formatHour(key: string): string {
  try {
    return new Date(key + ':00:00Z').toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return key }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

function groupByHour(alerts: AlertRecord[]): [string, AlertRecord[]][] {
  const map = new Map<string, AlertRecord[]>()
  for (const a of alerts) {
    const key = a.created_at.slice(0, 13)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(a)
  }
  return Array.from(map.entries())
}

const RANGES = ['1h', '24h', '7d'] as const
type Range = typeof RANGES[number]

export default async function TimelinePage({ searchParams }: PageProps) {
  const range = (sp(searchParams.range) as Range) ?? '24h'
  const alerts = await getTimeline({ range })
  const groups = groupByHour(alerts)

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Timeline</div>
          <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
            {alerts.length} events
          </div>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/timeline?range=${r}`}
              className="font-mono text-[11px] px-2.5 py-1 rounded-[8px] border transition-all duration-150"
              style={
                r === range
                  ? { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' }
                  : { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }
              }
            >
              {r}
            </Link>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-[12px] py-16 text-center font-mono text-[12px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          no events in the last {range}
        </div>
      ) : (
        <div className="fade-up-2 flex flex-col gap-6">
          {groups.map(([hourKey, group], gi) => (
            <div key={hourKey} className={gi === 0 ? 'fade-up-2' : ''}>
              {/* Hour separator */}
              <div className="flex items-center gap-3 mb-3">
                <div className="font-mono text-[10px] font-medium tracking-[0.06em] uppercase" style={{ color: 'var(--muted)' }}>
                  {formatHour(hourKey)}
                </div>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <div className="font-mono text-[10px]" style={{ color: 'var(--dim)' }}>
                  {group.length}
                </div>
              </div>

              {/* Alerts in this hour */}
              <div
                className="rounded-[12px] overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {group.map((alert, i) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 px-5 py-3"
                    style={{ borderBottom: i < group.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    <SevDot level={alert.rule_level} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                          {alert.rule_desc ?? alert.rule_id ?? '—'}
                        </span>
                        <SeverityChip level={alert.rule_level} />
                        <StatusBadge status={alert.status} />
                      </div>
                      <div className="font-mono text-[11px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--muted)' }}>
                        <span>{alert.agent_name ?? '—'}</span>
                        {alert.rule_id && <span>· rule:{alert.rule_id}</span>}
                        {alert.iocs && alert.iocs.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">
                            ·{alert.iocs.slice(0, 3).map((ioc, j) => (
                              <IocPill key={j} type={ioc.type} value={ioc.value} verdict={ioc.verdict} dense />
                            ))}
                            {alert.iocs.length > 3 && (
                              <span style={{ color: 'var(--dim)' }}>+{alert.iocs.length - 3}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--dim)' }}>
                      {formatTime(alert.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
