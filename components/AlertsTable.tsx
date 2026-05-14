'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AlertRecord, AlertStatus, Ioc } from '@/lib/types'

interface AlertsTableProps {
  alerts: AlertRecord[]
}

const PAGE_SIZE = 10

interface Severity {
  label: string
  color: string
}

function levelToSeverity(level: number | null): Severity {
  if (level == null) return { label: 'UNK', color: '#555555' }
  if (level >= 15) return { label: 'CRITICAL', color: '#ef4444' }
  if (level >= 12) return { label: 'HIGH', color: '#f97316' }
  if (level >= 7) return { label: 'MEDIUM', color: '#eab308' }
  return { label: 'LOW', color: '#22c55e' }
}

const STATUS_COLORS: Record<AlertStatus, string> = {
  pending: '#eab308',
  done: '#22c55e',
  error: '#ef4444',
  processing: '#3b82f6',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function IocBadge({ iocs }: { iocs: Ioc[] }) {
  if (!iocs || iocs.length === 0) return <span className="text-[#333333]">—</span>
  const hasMalicious = iocs.some((i) => i.verdict === 'MALICIOUS')
  return (
    <span
      className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
        hasMalicious
          ? 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10'
          : 'text-[#555555] border-[#333333]'
      }`}
    >
      {iocs.length} {hasMalicious && '⚠'}
    </span>
  )
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const color = STATUS_COLORS[status] ?? '#555555'
  return (
    <span
      className="text-xs font-mono px-1.5 py-0.5 rounded"
      style={{ color, border: `1px solid ${color}40`, background: `${color}15` }}
    >
      {status}
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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-[#333333] rounded w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded border"
              style={{ color: sev.color, border: `1px solid ${sev.color}40`, background: `${sev.color}15` }}
            >
              {sev.label}
            </span>
            <span className="text-[#e5e5e5] text-sm font-mono font-semibold truncate">
              {alert.rule_desc ?? alert.rule_id ?? `alert #${alert.id}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#555555] hover:text-[#e5e5e5] text-lg leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* metadata */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] grid grid-cols-2 gap-x-6 gap-y-1">
          {[
            ['time', formatTime(alert.created_at)],
            ['agent', alert.agent_name ?? '—'],
            ['rule id', alert.rule_id ?? '—'],
            ['user', alert.username ?? '—'],
            ['status', alert.status],
            ['retries', String(alert.retry_count)],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs font-mono">
              <span className="text-[#444444] w-14 flex-shrink-0">{k}</span>
              <span className="text-[#aaaaaa]">{v}</span>
            </div>
          ))}
        </div>

        {/* IOCs */}
        {alert.iocs && alert.iocs.length > 0 && (
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <div className="text-[#444444] text-xs font-mono mb-2">iocs ({alert.iocs.length})</div>
            <div className="flex flex-wrap gap-2">
              {alert.iocs.map((ioc, i) => (
                <span
                  key={i}
                  className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    ioc.verdict === 'MALICIOUS'
                      ? 'text-[#ef4444] border-[#ef4444]/30 bg-[#ef4444]/10'
                      : ioc.verdict === 'SUSPICIOUS'
                      ? 'text-[#f97316] border-[#f97316]/30 bg-[#f97316]/10'
                      : 'text-[#555555] border-[#333333]'
                  }`}
                >
                  {ioc.type}: {ioc.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* raw alert JSON */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <div className="text-[#444444] text-xs font-mono mb-2">raw alert</div>
          <pre className="text-[#888888] text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
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

  // reset to page 0 when alerts refresh
  useEffect(() => {
    setPage(0)
  }, [alerts])

  return (
    <>
      <div className="bg-[#111111] border border-[#222222] rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[#555555] text-xs font-mono uppercase tracking-widest">
            recent alerts
          </div>
          <div className="text-[#444444] text-xs font-mono">
            {alerts.length} total
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="text-[#333333] text-xs font-mono py-8 text-center">no alerts</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono min-w-[700px]">
                <thead>
                  <tr className="text-[#444444] border-b border-[#1e1e1e]">
                    <th className="text-left py-1 pr-4 font-normal w-36">time</th>
                    <th className="text-left py-1 pr-4 font-normal w-24">level</th>
                    <th className="text-left py-1 pr-4 font-normal">rule</th>
                    <th className="text-left py-1 pr-4 font-normal w-28">agent</th>
                    <th className="text-left py-1 pr-4 font-normal w-24">user</th>
                    <th className="text-left py-1 pr-3 font-normal w-16">iocs</th>
                    <th className="text-left py-1 font-normal w-24">status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageAlerts.map((alert) => {
                    const sev = levelToSeverity(alert.rule_level)
                    return (
                      <tr
                        key={alert.id}
                        className="border-b border-[#1a1a1a] hover:bg-[#151515] cursor-pointer transition-colors"
                        onClick={() => setSelected(alert)}
                      >
                        <td className="py-2 pr-4 text-[#555555] whitespace-nowrap">
                          {formatTime(alert.created_at)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              color: sev.color,
                              border: `1px solid ${sev.color}40`,
                              background: `${sev.color}15`,
                            }}
                          >
                            {alert.rule_level != null ? `${alert.rule_level} ${sev.label}` : sev.label}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[#aaaaaa] max-w-[200px]">
                          <span className="truncate block" title={alert.rule_desc ?? ''}>
                            {alert.rule_desc ?? alert.rule_id ?? '—'}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-[#777777] truncate max-w-[100px]">
                          {alert.agent_name ?? '—'}
                        </td>
                        <td className="py-2 pr-4 text-[#777777] truncate max-w-[80px]">
                          {alert.username ?? '—'}
                        </td>
                        <td className="py-2 pr-3">
                          <IocBadge iocs={alert.iocs ?? []} />
                        </td>
                        <td className="py-2">
                          <StatusBadge status={alert.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e1e1e]">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-[#555555] text-xs font-mono px-3 py-1 border border-[#333333] rounded hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← prev
                </button>
                <span className="text-[#444444] text-xs font-mono">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="text-[#555555] text-xs font-mono px-3 py-1 border border-[#333333] rounded hover:border-[#3b82f6] hover:text-[#3b82f6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
