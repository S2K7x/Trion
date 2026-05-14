import dynamic from 'next/dynamic'
import type { TopRule } from '@/lib/types'

const TopRulesChartInner = dynamic(() => import('./charts/TopRulesChartInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] bg-[#0d0d0d] animate-pulse rounded flex items-center justify-center">
      <span className="text-[#333333] text-xs font-mono">loading chart...</span>
    </div>
  ),
})

interface TopRulesChartProps {
  rules: TopRule[]
}

export function TopRulesChart({ rules }: TopRulesChartProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded p-4">
      <div className="text-[#555555] text-xs font-mono uppercase tracking-widest mb-3">
        top rules · last 7d
      </div>
      {rules.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-[#333333] text-xs font-mono">
          no data in last 7d
        </div>
      ) : (
        <TopRulesChartInner rules={rules} />
      )}
    </div>
  )
}
