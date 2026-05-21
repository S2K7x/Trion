'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'

interface Props {
  initialQ?: string
}

export function ReputationSearch({ initialQ = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(initialQ)
  const [isPending, startTransition] = useTransition()

  function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    startTransition(() => {
      router.push(`${pathname}?q=${encodeURIComponent(trimmed)}`)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(q)
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="IP, domain, hash, or URL…"
          className="flex-1 font-mono text-[12px] px-3 py-2 rounded-[8px] outline-none transition-colors duration-150"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={isPending || !q.trim()}
          className="font-mono text-[11px] px-4 py-2 rounded-[8px] border transition-all duration-150 disabled:opacity-40"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </form>
    </div>
  )
}
