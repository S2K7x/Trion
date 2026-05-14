'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { TopRule } from '@/lib/types'

interface TopRulesChartInnerProps {
  rules: TopRule[]
}

function truncate(s: string, n: number): string {
  return s && s.length > n ? s.slice(0, n) + '…' : s ?? ''
}

export default function TopRulesChartInner({ rules }: TopRulesChartInnerProps) {
  const data = rules.map((r) => ({
    name: truncate(r.rule_desc ?? r.rule_id ?? '—', 28),
    count: Number(r.count),
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fill: '#555555', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={{ stroke: '#333333' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={170}
          tick={{ fill: '#999999', fontSize: 10, fontFamily: 'monospace' }}
          axisLine={false}
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
          cursor={{ fill: '#1a1a1a' }}
        />
        <Bar dataKey="count" radius={[0, 2, 2, 0]} name="hits">
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={index === 0 ? '#ef4444' : index < 3 ? '#f97316' : '#3b82f6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
