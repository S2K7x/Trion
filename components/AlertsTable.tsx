'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AlertRecord, AlertStatus } from '@/lib/types'

interface AlertsTableProps {
  alerts: AlertRecord[]
}

const PAGE_SIZE = 10

interface Severity {
  label: string
  color: string
  dotClass: string
}

function levelToSeverity(level: number | null): Severity {
  if (level == null) return { label: 'UNK', color: 'var(--muted)', dotClass: '' }
  if (level >= 15) return { label: 'CRITICAL', color: 'var(--red)', dotClass: 'severity-critical-glow' }
  if (level >= 12) return { label: 'HIGH', color: 'var(--orange)', dotClass: '' }
  if (level >= 7)  return { label: 'MEDIUM', color: 'var(--yellow)', dotClass: '' }
  return { label: 'LOW', color: 'var(--green)', dotClass: '' }
}

const STATUS_STYLES: Record<AlertStatus, { bg: string; color: string; symbol: string }> = {
  pending:    { bg: 'var(--yellow-dim)', color: 'var(--yellow)',  symbol: '○' },
  processing: { bg: 'var(--accent-dim)', color: 'var(--accent)',  symbol: '●' },
  done:       { bg: 'var(--green-dim)',  color: 'var(--green)',   symbol: '✓' },
  error:      { bg: 'var(--red-dim)',    color: 'var(--red)',     symbol: '✕' },
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch { return iso }
}


function StatusBadge({ status }: { status: AlertStatus }) {
  const s = STATUS_STYLES[status] ?? { bg: 'transparent', color: 'var(--muted)', symbol: '?' }
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded"
      style={{ background: s.bg, color: s.color }}
    >
      {s.symbol} {status}
    </span>
  )
}

interface AlertModalProps {
  alert: AlertRecord
  onClose: () => void
}

function AlertModal({ alert, onClose }: AlertModalProps) {
  const sev = levelToSeverity(alert.rule_level)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.70)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-[12px]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* modal header */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded border"
              style={{
                color: sev.color,
                borderColor: `${sev.color}40`,
                background: `${sev.color}18`,
              }}
            >
              {sev.label}
            </span>
            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>
              {alert.rule_desc ?? alert.rule_id ?? `alert #${alert.id}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none ml-4 transition-colors duration-150 hover:text-[#e6edf3]"
            style={{ color: 'var(--muted)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* metadata */}
        <div
          className="px-5 py-3 grid grid-cols-2 gap-x-6 gap-y-1"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {[
            ['time', formatTime(alert.created_at)],
            ['agent', alert.agent_name ?? '—'],
            ['rule id', alert.rule_id ?? '—'],
            ['user', alert.username ?? '—'],
            ['status', alert.status],
            ['retries', String(alert.retry_count)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 font-mono text-[11px]">
              <span className="w-14 shrink-0" style={{ color: 'var(--border-2)' }}>{k}</span>
              <span style={{ color: 'var(--muted)' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* IOCs */}
        {alert.iocs && alert.iocs.length > 0 && (
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="font-mono text-[10px] mb-2" style={{ color: 'var(--muted)' }}>
              iocs ({alert.iocs.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {alert.iocs.map((ioc, i) => (
                <span
                  key={i}
                  className="font-mono text-[11px] px-2 py-0.5 rounded border"
                  style={
                    ioc.verdict === 'MALICIOUS'
                      ? { color: 'var(--red)',    borderColor: 'rgba(248,81,73,0.30)',  background: 'var(--red-dim)' }
                      : ioc.verdict === 'SUSPICIOUS'
                      ? { color: 'var(--orange)', borderColor: 'rgba(240,136,62,0.30)', background: 'rgba(240,136,62,0.10)' }
                      : { color: 'var(--muted)',  borderColor: 'var(--border)' }
                  }
                >
                  {ioc.type}: {ioc.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* raw JSON */}
        <div className="flex-1 overflow-auto px-5 py-3">
          <div className="font-mono text-[10px] mb-2" style={{ color: 'var(--muted)' }}>
            raw alert
          </div>
          <pre className="font-mono text-[11px] whitespace-pre-wrap break-all leading-relaxed" style={{ color: 'var(--muted)' }}>
            {JSON.stringify(alert.raw_alert, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AlertRecord | null>(null)

  const totalPages = Math.ceil(alerts.length / PAGE_SIZE)
  const pageAlerts = alerts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const closeModal = useCallback(() => setSelected(null), [])

  useEffect(() => { setPage(0) }, [alerts])

  return (
    <>
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
            Alert Queue
          </div>
          <div className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>
            {alerts.length} total
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="font-mono text-[12px] py-10 text-center" style={{ color: 'var(--border-2)' }}>
            no alerts
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Alert', 'Agent', 'Status', 'Time'].map((h) => (
                      <th
                        key={h}
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
                        className="transition-colors duration-100 cursor-pointer hover:bg-[#1c2330]"
                        style={{ borderBottom: '1px solid var(--border)' }}
                        onClick={() => setSelected(alert)}
                      >
                        <td className="px-5 py-3 align-middle">
                          <div className="flex items-center" style={{ color: 'var(--text)' }}>
                            <span
                              className={`inline-block w-[7px] h-[7px] rounded-full mr-2 shrink-0 ${sev.dotClass}`}
                              style={{ background: sev.color }}
                            />
                            <span className="text-[13px] font-semibold truncate max-w-[260px]">
                              {alert.rule_desc ?? alert.rule_id ?? '—'}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] mt-0.5 pl-[15px]" style={{ color: 'var(--muted)' }}>
                            rule:{alert.rule_id ?? '—'}
                            {alert.rule_level != null && ` · lvl ${alert.rule_level}`}
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
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="font-mono text-[11px] px-3 py-1 rounded border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[rgba(255,255,255,0.20)] hover:text-[#e6edf3]"
                  style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  ← prev
                </button>
                <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="font-mono text-[11px] px-3 py-1 rounded border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[rgba(255,255,255,0.20)] hover:text-[#e6edf3]"
                  style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}
                >
                  next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && <AlertModal alert={selected} onClose={closeModal} />}
    </>
  )
}
