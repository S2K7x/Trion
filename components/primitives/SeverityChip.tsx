// components/primitives/SeverityChip.tsx
import { levelToSeverity } from '@/lib/design'

export function SeverityChip({ level }: { level: number | null }) {
  const sev = levelToSeverity(level)
  return (
    <span
      className="inline-flex items-center font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded border"
      style={{
        color: sev.color,
        background: `color-mix(in oklab, ${sev.color} 12%, transparent)`,
        borderColor: `color-mix(in oklab, ${sev.color} 30%, transparent)`,
      }}
    >
      {sev.label}
    </span>
  )
}
