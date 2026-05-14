'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '@/lib/types'

interface TrendChartInnerProps {
  trend: TrendPoint[]
}

function formatHour(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function TrendChartInner({ trend }: TrendChartInnerProps) {
  const data = trend.map((p) => ({
    ...p,
    hour: formatHour(p.hour),
    count: Number(p.count),
    critical: Number(p.critical),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="hour"
          tick={{ fill: '#555555', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#333333' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#555555', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#333333' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#111111',
            border: '1px solid #333333',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#e5e5e5',
          }}
          labelStyle={{ color: '#777777' }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.1}
          strokeWidth={1.5}
          name="total"
        />
        <Area
          type="monotone"
          dataKey="critical"
          stroke="#ef4444"
          fill="#ef4444"
          fillOpacity={0.1}
          strokeWidth={1.5}
          name="critical"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
