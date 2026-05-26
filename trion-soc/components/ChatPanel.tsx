'use client'

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  mode: 'generic' | 'contextual'
  alertId?: string
  alertSeverity?: string
}

const GENERIC_SUGGESTIONS = [
  'What does CRITICAL mean?',
  'Explain common attack patterns',
  'How do I reduce false positives?',
]

const CONTEXTUAL_SUGGESTIONS = [
  'Is this a false positive?',
  "What's the risk?",
  'What should I do first?',
]

export function ChatPanel({ open, onClose, mode, alertId, alertSeverity: _alertSeverity }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = mode === 'contextual' ? CONTEXTUAL_SUGGESTIONS : GENERIC_SUGGESTIONS

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [open])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    autoResize(e.target)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, alert_id: alertId }),
      })
      const data = await res.json() as { message?: string; error?: string; fallback?: boolean }

      if (data.fallback || !data.message) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I'm currently unreachable. Please check your LLM configuration in Settings.",
          },
        ])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message! }])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-[420px]"
        style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Trion Assistant"
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div
              className="font-display font-bold text-[15px] tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              Trion Assistant
            </div>
            {mode === 'contextual' && alertId && (
              <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--accent)' }}>
                Analyzing alert #{alertId}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-[6px] transition-colors duration-100"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            aria-label="Close assistant"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* ── Messages ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            /* Empty state with quick suggestions */
            <div className="flex flex-col gap-3 mt-1">
              <p className="font-mono text-[12px] text-center" style={{ color: 'var(--muted)' }}>
                {mode === 'contextual'
                  ? 'Ask me anything about this alert.'
                  : 'Ask me anything about security.'}
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-3 py-2.5 rounded-[10px] font-mono text-[12px] transition-colors duration-100"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.color = 'var(--text)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--muted)'
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'var(--accent)',
                          color: '#0d1117',
                          borderRadius: '12px 12px 4px 12px',
                          fontFamily: 'var(--font-dm-mono), monospace',
                        }
                      : {
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          borderRadius: '12px 12px 12px 4px',
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3.5 py-2.5 font-mono text-[12px]"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  borderRadius: '12px 12px 12px 4px',
                }}
              >
                Trion is thinking
                <span className="inline-flex gap-px ml-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    >
                      .
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input ────────────────────────────────────────────────── */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex items-end gap-2 rounded-[12px] px-3 py-2 transition-colors duration-100"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
            onFocusCapture={(e) =>
              (e.currentTarget.style.borderColor = 'var(--accent)')
            }
            onBlurCapture={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border-2)')
            }
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask a security question…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent outline-none font-mono text-[13px] leading-relaxed"
              style={{ color: 'var(--text)', maxHeight: 120, minHeight: 22 }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-7 h-7 rounded-[8px] shrink-0 mb-0.5 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: '#0d1117' }}
              aria-label="Send message"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-3-9-3V1.5z" />
              </svg>
            </button>
          </div>
          <div
            className="font-mono text-[10px] mt-1.5 text-center"
            style={{ color: 'var(--muted)', opacity: 0.5 }}
          >
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>
    </>
  )
}
