// components/primitives/SeverityChip.tsx
import { levelToSeverity } from '@/lib/design'

const SEV_PHRASES: Record<string, string> = {
  CRITICAL: 'Immediate action required',
  HIGH:     'Review soon',
  MEDIUM:   'Monitor closely',
  LOW:      'Informational',
  UNK:      'Unknown severity',
}

export function SeverityChip({ level, showSub }: { level: number | null; showSub?: boolean }) {
  const sev = levelToSeverity(level)
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
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
      {showSub && (
        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
          {SEV_PHRASES[sev.label] ?? ''}
        </span>
      )}
    </span>
  )
}
