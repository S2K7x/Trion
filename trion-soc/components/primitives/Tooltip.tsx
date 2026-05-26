import type { ReactNode } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="relative inline-flex group/tooltip">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-2.5 py-2 rounded-[8px] font-mono text-[11px] leading-relaxed opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-50 text-left"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-2)',
          color: 'var(--muted)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          whiteSpace: 'normal',
        }}
      >
        {content}
      </span>
    </span>
  )
}
