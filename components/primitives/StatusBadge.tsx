// components/primitives/StatusBadge.tsx
import { STATUS_STYLES } from '@/lib/design'
import type { AlertStatus } from '@/lib/types'

export function StatusBadge({ status }: { status: AlertStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded ${s.pulse ? 'animate-trion-status-pulse' : ''}`}
      style={{ background: s.bg, color: s.color }}
    >
      <span style={{ fontSize: 9 }}>{s.symbol}</span> {status}
    </span>
  )
}
