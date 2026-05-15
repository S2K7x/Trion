// handoff/components/primitives/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: 'primary' | 'ghost' | 'mono'
  icon?: ReactNode
}

export function Button({ kind = 'primary', icon, children, className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center gap-1.5 rounded-[8px] border font-semibold transition-all duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed'

  const variant =
    kind === 'primary' ? 'text-[12px] px-3 py-[7px] border-transparent text-[#0d1117] bg-[var(--accent)] hover:bg-[#79b8ff]'
    : kind === 'mono' ? 'font-mono font-medium text-[11px] px-3 py-[6px] border-[var(--border-2)] text-[var(--muted)] hover:border-[rgba(255,255,255,0.22)] hover:text-[var(--text)] bg-transparent'
    :                   'text-[12px] px-3 py-[7px] border-[var(--border-2)] text-[var(--muted)] hover:border-[rgba(255,255,255,0.22)] hover:text-[var(--text)] bg-transparent'

  return (
    <button className={`${base} ${variant} ${className}`} {...rest}>
      {icon}{children}
    </button>
  )
}
