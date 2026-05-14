import dynamic from 'next/dynamic'
import type { TrendPoint } from '@/lib/types'

const TrendChartInner = dynamic(() => import('./charts/TrendChartInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] bg-[#0d0d0d] animate-pulse rounded flex items-center justify-center">
      <span className="text-[#333333] text-xs font-mono">loading chart...</span>
    </div>
  ),
})

interface TrendChartProps {
  trend: TrendPoint[]
}

export function TrendChart({ trend }: TrendChartProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded p-4">
      <div className="text-[#555555] text-xs font-mono uppercase tracking-widest mb-3">
        alerts / hour{' '}
        <span className="text-[#333333]">·</span>{' '}
        <span className="text-[#3b82f6]">■</span> total{' '}
        <span className="text-[#ef4444]">■</span> critical
      </div>
      {trend.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-[#333333] text-xs font-mono">
          no data in last 24h
        </div>
      ) : (
        <TrendChartInner trend={trend} />
      )}
    </div>
  )
}
