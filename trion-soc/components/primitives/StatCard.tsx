// components/primitives/StatCard.tsx
export interface StatCardProps {
  label: string
  value: string | number
  sub: string
  color?: string         // CSS var ref, e.g. 'var(--accent)'
  orb?: 'blue' | 'yellow' | 'green' | 'red'
  delta?: number         // optional ↑/↓ percentage
}

export function StatCard({ label, value, sub, color = 'var(--accent)', orb = 'blue', delta }: StatCardProps) {
  return (
    <div
      className={`stat-orb stat-orb-${orb} relative rounded-[12px] p-5 border transition-colors duration-200 hover:border-[rgba(255,255,255,0.10)]`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="text-[11px] font-semibold tracking-[0.06em] uppercase mb-2.5" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[28px] font-bold leading-none" style={{ color, letterSpacing: '-0.03em' }}>
          {value}
        </div>
        {delta != null && (
          <span className="font-mono text-[11px]" style={{ color: delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="font-mono text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}
