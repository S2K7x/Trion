// handoff/components/shell/Topbar.tsx
// Promoted from inline JSX in Header.tsx. Now reusable across all routes.

'use client'

interface TopbarProps {
  lastUpdate: Date
  n8nLive: boolean
  wazuhVersion: string
  user: { initials: string }
  onLogout: () => void
}

export function Topbar({ lastUpdate, n8nLive, wazuhVersion, user, onLogout }: TopbarProps) {
  const timeStr = lastUpdate.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <header
      className="flex items-center gap-4 px-6 h-full"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      <a href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight shrink-0 no-underline" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
        <div
          className="logo-diamond relative w-6 h-6 rounded-[6px] flex items-center justify-center overflow-hidden shrink-0"
          style={{ background: 'var(--accent)' }}
        />
        Trion
      </a>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border"
           style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n8nLive ? 'animate-trion-pulse' : ''}`}
              style={{ background: n8nLive ? 'var(--green)' : 'var(--red)' }} />
        n8n · {n8nLive ? 'live' : 'down'}
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border"
           style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
        <span className="text-[10px]" style={{ color: 'var(--accent)' }}>■</span>
        Wazuh {wazuhVersion}
      </div>

      <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>{timeStr}</div>

      <button
        onClick={onLogout}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all duration-150 hover:border-[rgba(255,255,255,0.22)] hover:text-[var(--text)]"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--muted)' }}
        title="Logout"
      >
        {user.initials}
      </button>
    </header>
  )
}
