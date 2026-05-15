// handoff/components/shell/Sidebar.tsx
// Promotes the inline Sidebar JSX from DashboardShell.tsx into a reusable
// component, and wires it to next/navigation. Keep your existing icon SVGs.

'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavDef {
  href: string
  label: string
  icon: ReactNode
  badge?: number
}

interface SidebarProps {
  monitor: NavDef[]
  threatIntel: NavDef[]
  system: NavDef[]
}

export function Sidebar({ monitor, threatIntel, system }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      className="flex flex-col gap-1 px-3 py-5 overflow-y-auto"
      style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      <NavSection label="Monitor" />
      {monitor.map((n) => <NavItem key={n.href} {...n} active={pathname === n.href} />)}

      <NavSection label="Threat Intel" />
      {threatIntel.map((n) => <NavItem key={n.href} {...n} active={pathname === n.href} />)}

      <NavSection label="System" />
      {system.map((n) => <NavItem key={n.href} {...n} active={pathname === n.href} />)}
    </nav>
  )
}

function NavSection({ label }: { label: string }) {
  return (
    <div
      className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase px-2 pt-3 pb-1.5"
      style={{ color: 'var(--muted)' }}
    >
      {label}
    </div>
  )
}

function NavItem({ href, label, icon, badge, active }: NavDef & { active: boolean }) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13px] font-semibold transition-all duration-150 cursor-pointer no-underline hover:bg-[var(--surface)]"
      style={active
        ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
        : { color: 'var(--muted)' }
      }
    >
      {active && <span className="nav-active" />}
      <span className="opacity-70 flex shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="ml-auto font-mono text-[10px] font-medium px-1.5 py-px rounded-full"
          style={{ background: 'var(--red-dim)', color: 'var(--red)' }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
