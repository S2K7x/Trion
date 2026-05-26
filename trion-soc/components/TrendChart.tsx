import dynamic from 'next/dynamic'
import type { TrendPoint } from '@/lib/types'

const TrendChartInner = dynamic(() => import('./charts/TrendChartInner'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[160px] rounded-[8px] animate-pulse flex items-center justify-center"
      style={{ background: 'var(--surface-2)' }}
    >
      <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>loading…</span>
    </div>
  ),
})

interface TrendChartProps {
  trend: TrendPoint[]
}

export function TrendChart({ trend }: TrendChartProps) {
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
          Security Events — Last 24 Hours
        </div>
        <div className="font-mono text-[10px] flex items-center gap-3" style={{ color: 'var(--muted)' }}>
          <span><span style={{ color: 'var(--accent)' }}>■</span> all events</span>
          <span><span style={{ color: 'var(--red)' }}>■</span> high severity</span>
        </div>
      </div>

      <div className="px-5 py-4">
        {trend.length === 0 ? (
          <div className="h-[140px] flex flex-col items-center justify-center gap-1">
            <div className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>No events in the last 24 hours</div>
            <div className="font-mono text-[11px]" style={{ color: 'var(--border-2)' }}>Your systems look clean.</div>
          </div>
        ) : (
          <TrendChartInner trend={trend} />
        )}
      </div>
    </div>
  )
}
