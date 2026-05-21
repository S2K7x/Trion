// components/primitives/PageHeader.tsx
import { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  right?: ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="fade-up-1 flex items-start justify-between mb-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight m-0" style={{ color: 'var(--text)' }}>{title}</h1>
        {subtitle && (
          <div className="font-mono text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
