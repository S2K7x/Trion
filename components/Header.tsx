'use client'

interface HeaderProps {
  lastUpdate?: Date
  onLogout: () => void
}

export function Header({ lastUpdate, onLogout }: HeaderProps) {
  const timeStr = lastUpdate?.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <header
      className="flex items-center gap-4 px-6 h-full"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      {/* Logo */}
      <a
        href="#"
        className="flex items-center gap-2.5 text-[16px] font-bold tracking-tight shrink-0 no-underline"
        style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
      >
        <div
          className="logo-diamond relative w-7 h-7 rounded-[6px] flex items-center justify-center overflow-hidden shrink-0"
          style={{ background: 'var(--accent)' }}
        />
        Trion
      </a>

      <div className="flex-1" />

      {/* n8n pill */}
      <div
        className="flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        <span className="animate-trion-pulse w-1.5 h-1.5 rounded-full bg-trion-green shrink-0" />
        n8n · live
      </div>

      {/* Wazuh pill */}
      <div
        className="flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        <span className="text-trion-accent text-[10px]">■</span>
        Wazuh 4.9
      </div>

      {/* Sync time */}
      {timeStr && (
        <div className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
          {timeStr}
        </div>
      )}

      {/* Logout as avatar button */}
      <button
        onClick={onLogout}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all duration-150 hover:border-[rgba(255,255,255,0.20)] hover:text-trion-text"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border-2)',
          color: 'var(--muted)',
        }}
        title="Logout"
      >
        DM
      </button>
    </header>
  )
}
