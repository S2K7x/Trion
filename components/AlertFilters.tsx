'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export function AlertFilters({ initial }: { initial: Record<string, string | undefined> }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const set = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(sp.toString())
    if (value === 'all' || value === '') next.delete(key)
    else next.set(key, value)
    next.delete('page')
    router.push(`${pathname}?${next.toString()}`)
  }, [sp, router, pathname])

  const selectCls =
    'font-mono text-[11px] px-2.5 py-1.5 rounded-[8px] border outline-none appearance-none cursor-pointer'
  const selectStyle = {
    background: 'var(--surface)',
    borderColor: 'var(--border-2)',
    color: 'var(--text)',
  }

  return (
    <div
      className="rounded-[12px] p-3.5 flex items-center gap-2.5 flex-wrap"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <input
        className="font-mono text-[12px] px-3 py-1.5 rounded-[8px] border outline-none flex-1 min-w-[200px]"
        style={{ background: 'var(--bg)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
        placeholder="search alerts, rule id, agent…"
        defaultValue={initial.q}
        onChange={(e) => set('q', e.target.value)}
      />
      <select
        className={selectCls}
        style={selectStyle}
        defaultValue={initial.severity ?? 'all'}
        onChange={(e) => set('severity', e.target.value)}
      >
        <option value="all">severity: all</option>
        <option value="critical">critical</option>
        <option value="high">high</option>
        <option value="medium">medium</option>
        <option value="low">low</option>
      </select>
      <select
        className={selectCls}
        style={selectStyle}
        defaultValue={initial.status ?? 'all'}
        onChange={(e) => set('status', e.target.value)}
      >
        <option value="all">status: all</option>
        <option value="pending">pending</option>
        <option value="processing">processing</option>
        <option value="done">done</option>
        <option value="error">error</option>
      </select>
      <select
        className={selectCls}
        style={selectStyle}
        defaultValue={initial.range ?? '24h'}
        onChange={(e) => set('range', e.target.value)}
      >
        <option value="1h">1h</option>
        <option value="24h">24h</option>
        <option value="7d">7d</option>
        <option value="30d">30d</option>
      </select>
    </div>
  )
}
