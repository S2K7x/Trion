'use client'

interface ChatButtonProps {
  onClick: () => void
  showBadge?: boolean
}

export function ChatButton({ onClick, showBadge }: ChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
      style={{ background: 'var(--accent)', color: '#0d1117' }}
      aria-label="Open Trion Assistant"
    >
      {showBadge && (
        <span
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
          style={{ background: 'var(--red)', boxShadow: '0 0 0 2px var(--bg)' }}
        />
      )}
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 9.33A6 6 0 1 0 4.68 13.3L2 14l.7-2.68A6 6 0 0 0 14 9.33z" />
      </svg>
      <span className="font-display font-bold text-[13px] whitespace-nowrap">Ask Trion</span>
    </button>
  )
}
