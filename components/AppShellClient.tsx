'use client'

import { useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Header } from './Header'

export function AppShellClient({ pending, children }: { pending: number; children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }, [router])

  return (
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: '220px 1fr',
        gridTemplateRows: '56px 1fr',
        background: 'var(--bg)',
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Header onLogout={logout} />
      </div>

      <nav
        className="flex flex-col gap-1 px-3 py-5 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <NavSection label="Monitor" />
        <NavItem href="/" active={pathname === '/'} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1.5"/>
            <rect x="9" y="1" width="6" height="6" rx="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5"/>
            <rect x="9" y="9" width="6" height="6" rx="1.5"/>
          </svg>
        }>Overview</NavItem>

        <NavItem href="/alerts" active={pathname === '/alerts'} badge={pending > 0 ? pending : undefined} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h12M2 8h8M2 12h10"/>
          </svg>
        }>Alert Queue</NavItem>

        <NavItem href="/timeline" active={pathname === '/timeline'} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/>
          </svg>
        }>Timeline</NavItem>

        <NavSection label="Threat Intel" />
        <NavItem href="/iocs" active={pathname === '/iocs'} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1z"/>
          </svg>
        }>IOCs</NavItem>

        <NavItem href="/reputation" active={pathname === '/reputation'} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4"/><path d="M10 10l4 4"/>
          </svg>
        }>Reputation</NavItem>

        <NavSection label="System" />
        <NavItem href="/workflows" active={pathname === '/workflows'} icon={
          <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/><circle cx="8" cy="8" r="3"/>
          </svg>
        }>Workflows</NavItem>

        <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <NavItem href="/" active={false} icon={
            <svg className="w-4 h-4 opacity-70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
          }>demo</NavItem>
        </div>
      </nav>

      {children}
    </div>
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

function NavItem({
  children,
  href,
  active,
  badge,
  icon,
}: {
  children: ReactNode
  href: string
  active: boolean
  badge?: number
  icon: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-[8px] text-[13px] font-semibold transition-all duration-150 no-underline ${
        active ? '' : 'hover:bg-trion-surface hover:text-trion-text'
      }`}
      style={active ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : { color: 'var(--muted)' }}
    >
      {active && <span className="nav-active" />}
      {icon}
      <span className="truncate">{children}</span>
      {badge !== undefined && (
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
