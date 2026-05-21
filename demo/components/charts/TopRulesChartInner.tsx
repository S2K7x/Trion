'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
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
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fill: '#7d8590', fontSize: 9, fontFamily: 'var(--font-dm-mono, monospace)' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={170}
          tick={{ fill: '#7d8590', fontSize: 9, fontFamily: 'var(--font-dm-mono, monospace)' }}
          axisLine={false}
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
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} name="hits">
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={index === 0 ? '#f85149' : index < 3 ? '#f0883e' : '#58a6ff'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
