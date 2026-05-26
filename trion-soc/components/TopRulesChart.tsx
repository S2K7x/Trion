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
          Most Frequent Detections — Last 7 Days
        </div>
      </div>

      <div className="px-5 py-4">
        {rules.length === 0 ? (
          <div className="h-[160px] flex flex-col items-center justify-center gap-1">
            <div className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>No detections recorded in the last 7 days</div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--border-2)' }}>No patterns to display yet.</div>
          </div>
        ) : (
          <TopRulesChartInner rules={rules} />
        )}
      </div>
    </div>
  )
}
