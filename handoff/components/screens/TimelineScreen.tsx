// handoff/components/screens/TimelineScreen.tsx
//
// Chronological event feed, grouped by hour. Combines alerts + audit log.
// Server component — fetches on render. Add `revalidate = 30` for polling.
//
// Visual reference: see Trion.html → "Timeline" screen.

import { PageHeader } from '@/components/primitives/PageHeader'
import { Panel } from '@/components/primitives/Panel'
import { SevDot } from '@/components/primitives/SevDot'
import { SeverityChip } from '@/components/primitives/SeverityChip'
import { StatusBadge } from '@/components/primitives/StatusBadge'
import { IocPill } from '@/components/primitives/IocPill'
import { getTimelineEvents } from '@/lib/queries'
import type { AlertRecord, AuditEvent } from '@/lib/types'

type TimelineItem =
  | { kind: 'alert'; ts: string; data: AlertRecord }
  | { kind: 'audit'; ts: string; data: AuditEvent }

export async function TimelineScreen() {
  const items = await getTimelineEvents({ limit: 80 })

  // Group by hour (YYYY-MM-DDTHH)
  const groups = new Map<string, TimelineItem[]>()
  for (const it of items) {
    const k = new Date(it.ts).toISOString().slice(0, 13)
    const list = groups.get(k) ?? []
    list.push(it)
    groups.set(k, list)
  }
  const hours = Array.from(groups.keys()).sort().reverse()

  return (
    <div className="px-8 py-7">
      <PageHeader title="Timeline" subtitle="chronological event feed · alerts + audit" />

      <div className="fade-up-2 grid gap-4" style={{ gridTemplateColumns: '1fr 280px' }}>
        <div className="relative">
          <div className="absolute left-[14px] top-0 bottom-0 w-px" style={{ background: 'var(--border)' }} />
          {hours.map((k) => {
            const group = groups.get(k)!
            const date = new Date(group[0].ts)
            const hourLabel = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            return (
              <div key={k} className="mb-4">
                <div className="flex items-center gap-3 mb-2.5 relative">
                  <div className="w-[29px] h-[29px] rounded-full grid place-items-center relative z-[1]"
                       style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
                    ◷
                  </div>
                  <span className="font-mono text-[11px] font-medium tracking-wide" style={{ color: 'var(--text)' }}>{hourLabel}</span>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>· {group.length} events</span>
                </div>
                <div className="ml-11">
                  {group.map((it, i) => it.kind === 'alert' ? <AlertEntry key={i} a={it.data} /> : <AuditEntry key={i} e={it.data} />)}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Filter">
            <div className="p-4 text-[12px]" style={{ color: 'var(--muted)' }}>
              {/* TODO: severity / kind checkboxes (client component) */}
              Severity & kind checkboxes go here.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function AlertEntry({ a }: { a: AlertRecord }) {
  return (
    <div className="rounded-[12px] mb-1.5 px-3.5 py-2.5 flex items-start gap-3 cursor-pointer transition-colors hover:border-[var(--border-2)]"
         style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <SevDot level={a.rule_level} size={8} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SeverityChip level={a.rule_level} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{a.rule_desc}</span>
        </div>
        <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
          rule:{a.rule_id} · agent:{a.agent_name}{a.username ? ` · user:${a.username}` : ''}
        </div>
        {a.iocs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.iocs.slice(0, 3).map((i, idx) => <IocPill key={idx} type={i.type} value={i.value} verdict={i.verdict} dense />)}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <StatusBadge status={a.status} />
      </div>
    </div>
  )
}

function AuditEntry({ e }: { e: AuditEvent }) {
  return (
    <div className="py-2 mb-1 flex items-center gap-3">
      <span className="w-1.5 h-1.5 rounded-full border" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }} />
      <span className="font-mono text-[11px] min-w-[130px]" style={{ color: 'var(--accent)' }}>{e.action}</span>
      <span className="font-mono text-[11px] flex-1 truncate" style={{ color: 'var(--muted)' }}>{e.actor} → {e.target}</span>
    </div>
  )
}
