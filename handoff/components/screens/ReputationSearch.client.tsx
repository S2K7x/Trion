// handoff/components/screens/ReputationSearch.client.tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, FormEvent } from 'react'

export function ReputationSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [q, setQ] = useState(initialQuery)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    router.push(`${pathname}?q=${encodeURIComponent(q)}`)
  }

  const RECENTS = ['185.220.101.42', 'login-secure.evil.tk', '45.155.205.233', 'cdn-resolve.click']

  return (
    <form onSubmit={submit} className="fade-up-2 mb-5">
      <div className="flex gap-2">
        <input
          className="font-mono text-[13px] flex-1 px-4 rounded-[8px] border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-2)', color: 'var(--text)', height: 44 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="enter IP address, domain, URL, MD5 or SHA256…"
        />
        <button
          type="submit"
          className="px-4 rounded-[8px] text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: '#0d1117', height: 44 }}
        >
          Lookup
        </button>
      </div>
      <div className="flex gap-3 mt-2.5 items-center">
        <span className="font-mono text-[11px]" style={{ color: 'var(--dim)' }}>recent:</span>
        {RECENTS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => { setQ(r); router.push(`${pathname}?q=${encodeURIComponent(r)}`) }}
            className="font-mono text-[11px] underline underline-offset-2 bg-transparent border-none p-0"
            style={{ color: 'var(--muted)', textDecorationColor: 'var(--border-2)' }}
          >
            {r}
          </button>
        ))}
      </div>
    </form>
  )
}
