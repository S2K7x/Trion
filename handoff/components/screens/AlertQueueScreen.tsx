// handoff/components/screens/AlertQueueScreen.tsx
//
// Full alert queue with filters + pagination.
// Server component: fetch the page of alerts via getAlertsPaginated().
// Filter chrome below is a client component (use client) — see <AlertFilters />.
//
// Visual reference: see Trion.html → "Alert Queue" screen.

import { Suspense } from 'react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Panel } from '@/components/primitives/Panel'
import { Button } from '@/components/primitives/Button'
import { StatusBadge } from '@/components/primitives/StatusBadge'
import { SevDot } from '@/components/primitives/SevDot'
import { SeverityChip } from '@/components/primitives/SeverityChip'
import { AlertFilters } from './AlertFilters.client'
import { getAlertsPaginated } from '@/lib/queries'
import { levelToSeverity, timeAgo } from '@/lib/design'

interface AlertQueueScreenProps {
  searchParams?: {
    severity?: string
    status?: string
    agent?: string
    range?: string
    q?: string
    page?: string
  }
}

export async function AlertQueueScreen({ searchParams = {} }: AlertQueueScreenProps) {
  const page = Number(searchParams.page ?? 0)
  const { rows, total } = await getAlertsPaginated({
    severity: searchParams.severity ?? 'all',
    status:   searchParams.status ?? 'all',
    agent:    searchParams.agent ?? 'all',
    range:    searchParams.range ?? '24h',
    q:        searchParams.q ?? '',
    page,
    pageSize: 12,
  })

  return (
    <div className="px-8 py-7">
      <PageHeader
        title="Alert Queue"
        subtitle={`${total} alerts · server-side filter`}
        right={
          <>
            <Button kind="ghost">export CSV</Button>
            <Button kind="primary">Triage selected</Button>
          </>
        }
      />

      <Suspense fallback={null}>
        <AlertFilters initial={searchParams} />
      </Suspense>

      <div className="fade-up-3 mt-4">
        <Panel right={<span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{page * 12 + 1}–{Math.min((page + 1) * 12, total)} of {total}</span>}>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Severity', 'Alert', 'Agent', 'User', 'IOCs', 'Status', 'Time'].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="transition-colors duration-100 cursor-pointer hover:bg-[var(--surface-2)]" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-3"><input type="checkbox" /></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><SevDot level={a.rule_level} /><SeverityChip level={a.rule_level} /></div></td>
                    <td className="px-5 py-3">
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{a.rule_desc}</div>
                      <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        #{a.id} · rule:{a.rule_id} · lvl {a.rule_level}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px]" style={{ color: 'var(--text)' }}>
                      {a.agent_name}
                      <div className="text-[10px]" style={{ color: 'var(--dim)' }}>{a.agent_ip}</div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{a.username ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-[11px]" style={{ color: a.iocs.length ? 'var(--red)' : 'var(--dim)' }}>
                      {a.iocs.length ? `${a.iocs.length} ✕` : '—'}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3 font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}
