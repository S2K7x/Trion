'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AlertRecord } from '@/lib/types'
import { levelToSeverity } from '@/lib/design'
import { StatusBadge } from '@/components/primitives/StatusBadge'

interface AlertsTableProps {
  alerts: AlertRecord[]
}

const PAGE_SIZE = 10

const SEV_PHRASES: Record<string, string> = {
  CRITICAL: 'Immediate action required',
  HIGH:     'Review soon',
  MEDIUM:   'Monitor closely',
  LOW:      'Informational',
  UNK:      'Unknown',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const [page, setPage] = useState(0)
  const router = useRouter()

  const totalPages = Math.ceil(alerts.length / PAGE_SIZE)
  const pageAlerts = alerts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [alerts])

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* panel header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Recent Alerts
        </div>
        <div className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>
          {alerts.length} total
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center gap-1.5">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--muted)' }}>No alerts in the last 24 hours</div>
          <div className="font-mono text-[11px]" style={{ color: 'var(--border-2)' }}>Your systems look clean.</div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Alert', 'Agent', 'Status', 'Time', ''].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-5 py-2.5 font-mono text-[10px] font-medium tracking-[0.08em] uppercase"
                      style={{ color: 'var(--muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageAlerts.map((alert) => {
                  const sev = levelToSeverity(alert.rule_level)
                  return (
                    <tr
                      key={alert.id}
                      className="group transition-colors duration-100 cursor-pointer hover:bg-trion-surface2"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={() => router.push('/alerts/' + alert.id)}
                    >
                      <td className="px-5 py-3 align-middle">
                        <div className="flex items-center" style={{ color: 'var(--text)' }}>
                          <span
                            className={`inline-block w-[7px] h-[7px] rounded-full mr-2 shrink-0 ${sev.glow ? 'severity-critical-glow' : ''}`}
                            style={{ background: sev.color }}
                          />
                          <span className="text-[13px] font-semibold truncate max-w-[260px]">
                            {alert.rule_desc ?? alert.rule_id ?? '—'}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] mt-0.5 pl-[15px]" style={{ color: sev.color, opacity: 0.7 }}>
                          {SEV_PHRASES[sev.label]}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-middle font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                        {alert.agent_name ?? '—'}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <StatusBadge status={alert.status} />
                      </td>
                      <td className="px-5 py-3 align-middle font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {formatTime(alert.created_at)}
                      </td>
                      <td className="px-4 py-3 align-middle w-6">
                        <span
                          className="font-mono text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                          style={{ color: 'var(--muted)' }}
                        >
                          →
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setPage((p) => Math.max(0, p - 1)) }}
                disabled={page === 0}
                className="font-mono text-[11px] px-3 py-1 rounded border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[rgba(255,255,255,0.20)] hover:text-trion-text"
                style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                ← prev
              </button>
              <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setPage((p) => Math.min(totalPages - 1, p + 1)) }}
                disabled={page === totalPages - 1}
                className="font-mono text-[11px] px-3 py-1 rounded border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[rgba(255,255,255,0.20)] hover:text-trion-text"
                style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
