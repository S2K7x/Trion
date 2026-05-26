import dynamic from 'next/dynamic'
import type { TopRule } from '@/lib/types'

const TopRulesChartInner = dynamic(() => import('./charts/TopRulesChartInner'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[200px] rounded-[8px] animate-pulse flex items-center justify-center"
      style={{ background: 'var(--surface-2)' }}
    >
      <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>loading…</span>
    </div>
  ),
})

interface TopRulesChartProps {
  rules: TopRule[]
}

export function TopRulesChart({ rules }: TopRulesChartProps) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Top rules · last 7d
        </div>
      </div>

      <div className="px-5 py-4">
        {rules.length === 0 ? (
          <div
            className="h-[160px] flex items-center justify-center font-mono text-[12px]"
            style={{ color: 'var(--border-2)' }}
          >
            no data in last 7d
          </div>
        ) : (
          <TopRulesChartInner rules={rules} />
        )}
      </div>
    </div>
  )
}
