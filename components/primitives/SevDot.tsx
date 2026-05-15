// components/primitives/SevDot.tsx
import { levelToSeverity } from '@/lib/design'

export function SevDot({ level, size = 7 }: { level: number | null; size?: number }) {
  const sev = levelToSeverity(level)
  return (
    <span
      className={`inline-block rounded-full shrink-0 ${sev.glow ? 'severity-critical-glow' : ''}`}
      style={{ background: sev.color, width: size, height: size }}
    />
  )
}
