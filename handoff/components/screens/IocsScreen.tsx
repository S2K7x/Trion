// handoff/components/screens/IocsScreen.tsx
//
// Browsable IOC table with type / verdict filters + side detail panel.
// Visual reference: see Trion.html → "IOCs" screen.

import { PageHeader } from '@/components/primitives/PageHeader'
import { Panel } from '@/components/primitives/Panel'
import { Button } from '@/components/primitives/Button'
import { getIocsPaginated } from '@/lib/queries'
import { scoreColor, timeAgo } from '@/lib/design'

interface IocsScreenProps {
  searchParams?: {
    type?: string
    verdict?: string
    q?: string
    page?: string
  }
}

export async function IocsScreen({ searchParams = {} }: IocsScreenProps) {
  const rows = await getIocsPaginated({
    type:    searchParams.type ?? 'all',
    verdict: searchParams.verdict ?? 'all',
    q:       searchParams.q ?? '',
    page:    Number(searchParams.page ?? 0),
    pageSize: 30,
  })

  return (
    <div className="px-8 py-7">
      <PageHeader
        title="IOCs"
        subtitle={`${rows.length} indicators · enriched by VirusTotal · AbuseIPDB · MalwareBazaar`}
        right={
          <>
            <Button kind="ghost">export STIX</Button>
            <Button kind="primary">+ Add indicator</Button>
          </>
        }
      />

      <Panel
        title="Indicators of compromise"
        right={<span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>last 7d</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Indicator', 'Verdict', 'VT', 'AbuseIPDB', 'MalwareBazaar', 'Hits', 'Last seen'].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 font-mono text-[10px] font-medium tracking-[0.08em] uppercase"
                      style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((ioc) => (
                <tr key={ioc.ioc_value} className="cursor-pointer hover:bg-[var(--surface-2)] transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[9px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: ioc.ioc_type === 'IP' ? 'var(--accent-dim)' : ioc.ioc_type === 'MD5' ? 'var(--yellow-dim)' : 'var(--green-dim)',
                            color: ioc.ioc_type === 'IP' ? 'var(--accent)' : ioc.ioc_type === 'MD5' ? 'var(--yellow)' : 'var(--green)',
                          }}>
                      {ioc.ioc_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] max-w-[280px] truncate" style={{ color: 'var(--text)' }}>{ioc.ioc_value}</td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded"
                          style={{
                            background: ioc.verdict === 'MALICIOUS' ? 'var(--red-dim)' : 'var(--orange-dim)',
                            color: ioc.verdict === 'MALICIOUS' ? 'var(--red)' : 'var(--orange)',
                          }}>
                      {ioc.verdict}
                    </span>
                  </td>
                  <td className="px-5 py-3"><ScoreCell value={ioc.vt} total={94} /></td>
                  <td className="px-5 py-3"><ScoreCell value={ioc.abuse} total={100} /></td>
                  <td className="px-5 py-3 font-mono text-[11px]" style={{ color: ioc.mb ? 'var(--red)' : 'var(--dim)' }}>{ioc.mb ?? '—'}</td>
                  <td className="px-5 py-3 font-mono text-[11px] font-semibold" style={{ color: scoreColor(ioc.occurrences, 10) }}>×{ioc.occurrences}</td>
                  <td className="px-5 py-3 font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>{timeAgo(ioc.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function ScoreCell({ value, total }: { value: number | null; total: number }) {
  if (value == null) return <span className="font-mono text-[11px]" style={{ color: 'var(--dim)' }}>—</span>
  const pct = value / total
  const color = scoreColor(value, total)
  return (
    <div className="flex flex-col gap-0.5 min-w-[70px]">
      <span className="font-mono text-[11px] font-semibold" style={{ color }}>{value}<span style={{ color: 'var(--dim)', fontWeight: 400 }}>/{total}</span></span>
      <div className="h-0.5 rounded-sm" style={{ background: 'var(--surface-2)' }}>
        <div className="h-full rounded-sm" style={{ background: color, width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}
