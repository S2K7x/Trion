'use client'

interface HeaderProps {
  lastUpdate: Date
  onLogout: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function Header({ lastUpdate, onLogout }: HeaderProps) {
  return (
    <header className="flex items-center justify-between py-3 px-4 border-b border-[#222222]">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
        <span className="text-[#e5e5e5] font-mono font-semibold tracking-wider">mini-soc</span>
      </div>

      <div className="text-[#555555] text-xs font-mono">
        last update:{' '}
        <span className="text-[#777777]">
          {formatDate(lastUpdate)} · {formatTime(lastUpdate)}
        </span>
      </div>

      <button
        onClick={onLogout}
        className="text-[#555555] text-xs font-mono border border-[#333333] px-3 py-1 rounded hover:border-[#ef4444] hover:text-[#ef4444] transition-colors"
      >
        logout
      </button>
    </header>
  )
}
