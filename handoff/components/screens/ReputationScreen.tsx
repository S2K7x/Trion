// handoff/components/screens/ReputationScreen.tsx
//
// IP / domain / hash lookup with multi-source score breakdown.
// `<ReputationSearch />` is a client component (controlled input + recents).
// The score detail panels are server components fed by getReputation().
//
// Visual reference: see Trion.html → "Reputation" screen.

import { PageHeader } from '@/components/primitives/PageHeader'
import { Panel } from '@/components/primitives/Panel'
import { Button } from '@/components/primitives/Button'
import { ReputationSearch } from './ReputationSearch.client'
import { getReputation } from '@/lib/queries'
import { scoreColor, timeAgo } from '@/lib/design'

interface ReputationScreenProps {
  searchParams?: { q?: string }
}

export async function ReputationScreen({ searchParams = {} }: ReputationScreenProps) {
  const q = searchParams.q ?? '185.220.101.42'
  const rep = await getReputation(q)

  return (
    <div className="px-8 py-7">
      <PageHeader
        title="Reputation"
        subtitle="IP / domain / hash lookup · multi-source enrichment"
      />

      <ReputationSearch initialQuery={q} />

      {!rep ? (
        <div className="font-mono text-[12px] py-16 text-center" style={{ color: 'var(--dim)' }}>
          no data for <span style={{ color: 'var(--muted)' }}>{q}</span>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <Panel>
            <div className="p-5 flex items-center gap-6">
              <Gauge value={rep.confidence} color="var(--red)" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[11px] font-medium px-2.5 py-0.5 rounded"
                        style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>{rep.verdict}</span>
                  <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{rep.type}</span>
                </div>
                <div className="font-mono text-[20px]" style={{ color: 'var(--text)' }}>{rep.indicator}</div>
                <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <Row k="first seen" v={timeAgo(rep.first_seen)} />
                  <Row k="last seen"  v={timeAgo(rep.last_seen)} />
                  {rep.country && <Row k="country" v={rep.country} />}
                  {rep.asn && <Row k="asn"     v={rep.asn} />}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Sources">
            {rep.sources.map((s, i) => (
              <div key={s.name} className="px-5 py-4" style={{ borderBottom: i < rep.sources.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{s.name}</div>
                  <div className="font-mono">
                    <span className="text-[18px] font-bold" style={{ color: scoreColor(s.score, s.total) }}>{s.score}</span>
                    <span className="text-[11px]" style={{ color: 'var(--dim)' }}>/{s.total}</span>
                  </div>
                </div>
                <div className="h-0.5 rounded-sm overflow-hidden mb-2.5" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-sm transition-all duration-500"
                       style={{ width: `${(s.score / s.total) * 100}%`, background: scoreColor(s.score, s.total) }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.categories.map((c) => (
                    <span key={c} className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--dim)' }}>{k}</span>
      <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{v}</span>
    </>
  )
}

function Gauge({ value, color }: { value: number; color: string }) {
  const r = 38, c = 2 * Math.PI * r
  const off = c - (value / 100) * c
  return (
    <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-bold tracking-tighter" style={{ color }}>{value}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>conf.</span>
      </div>
    </div>
  )
}
