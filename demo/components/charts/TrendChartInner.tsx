'use client'

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '@/lib/types'

interface TrendChartInnerProps {
  trend: TrendPoint[]
}

function formatHour(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function TrendChartInner({ trend }: TrendChartInnerProps) {
  const data = trend.map((p) => ({
    ...p,
    hour: formatHour(p.hour),
    count: Number(p.count),
    critical: Number(p.critical),
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="hour"
          tick={{ fill: '#7d8590', fontSize: 9, fontFamily: 'var(--font-dm-mono, monospace)' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#7d8590', fontSize: 9, fontFamily: 'var(--font-dm-mono, monospace)' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#161b22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px',
            fontFamily: 'var(--font-dm-mono, monospace)',
            fontSize: '11px',
            color: '#e6edf3',
          }}
          labelStyle={{ color: '#7d8590' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#58a6ff"
          fill="#58a6ff"
          fillOpacity={0.08}
          strokeWidth={1.5}
          name="total"
        />
        <Area
          type="monotone"
          dataKey="critical"
          stroke="#f85149"
          fill="#f85149"
          fillOpacity={0.08}
          strokeWidth={1.5}
          name="critical"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
