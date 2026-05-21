// components/primitives/IocPill.tsx
import { iocTypeStyle } from '@/lib/design'

export interface IocPillProps {
  type: string
  value: string
  verdict?: string
  dense?: boolean
}

export function IocPill({ type, value, verdict, dense }: IocPillProps) {
  const t = (type || '').toUpperCase()
  const p = iocTypeStyle(t, verdict)
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[11px] rounded border"
      style={{
        color: p.c,
        borderColor: p.b,
        background: p.bg,
        padding: dense ? '1px 6px' : '2px 8px',
      }}
    >
      <span className="text-[9px] font-medium tracking-[0.06em] uppercase">{t.slice(0, 6)}</span>
      {value && (
        <>
          <span className="block w-px h-[9px] opacity-25" style={{ background: 'currentColor' }} />
          <span style={{ color: 'var(--text)' }}>{value}</span>
        </>
      )}
    </span>
  )
}
