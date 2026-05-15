// handoff/components/primitives/Panel.tsx
import { ReactNode } from 'react'

export interface PanelProps {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}

export function Panel({ title, subtitle, right, footer, children, className = '' }: PanelProps) {
  return (
    <div
      className={`rounded-[12px] overflow-hidden transition-colors duration-150 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-5 py-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            {title && (
              <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>· {subtitle}</div>
            )}
          </div>
          {right && <div className="flex items-center gap-2">{right}</div>}
        </div>
      )}
      {children}
      {footer && (
        <div style={{ borderTop: '1px solid var(--border)' }} className="px-5 py-2.5">{footer}</div>
      )}
    </div>
  )
}
