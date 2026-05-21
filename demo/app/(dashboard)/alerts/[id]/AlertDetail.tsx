'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AlertRecord, LlmVerdict } from '@/lib/types'
import { levelToSeverity } from '@/lib/design'
import { IocPill } from '@/components/primitives/IocPill'
import { SeverityChip } from '@/components/primitives/SeverityChip'
import { StatusBadge } from '@/components/primitives/StatusBadge'

type SevKey = 'critical' | 'high' | 'medium' | 'low'

const SEV_MAP: Record<SevKey, { bg: string; label: string; text: string }> = {
  critical: { bg: '#f85149', label: '🔴 Critical Alert', text: '#fff' },
  high:     { bg: '#f0883e', label: '🟠 High Alert',     text: '#fff' },
  medium:   { bg: '#e3b341', label: '🟡 Medium Alert',   text: '#0d1117' },
  low:      { bg: '#3fb950', label: '🟢 Low Alert',      text: '#0d1117' },
}

function resolveSeverity(lv: LlmVerdict | null | undefined, level: number | null): SevKey {
  if (lv?.severity && lv.severity in SEV_MAP) return lv.severity as SevKey
  const label = levelToSeverity(level).label.toLowerCase()
  if (label === 'critical' || label === 'high' || label === 'medium' || label === 'low') {
    return label as SevKey
  }
  return 'low'
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function genericAction(level: number | null): string {
  if (!level) return 'Monitor the alert and contact your security team if it repeats.'
  if (level >= 12) return 'Escalate immediately to your security team for investigation.'
  if (level >= 7)  return 'Review the affected system and check for unusual activity.'
  return 'Monitor closely — no immediate action required.'
}

function Card({
  title, children, accent, className = '',
}: { title: string; children: React.ReactNode; accent: string; className?: string }) {
  return (
    <div
      className={`rounded-[12px] overflow-hidden ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${accent}` }}
    >
      <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-[11px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--muted)' }}>
          {title}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colorMap: Record<string, string> = { high: 'var(--green)', medium: 'var(--yellow)', low: 'var(--muted)' }
  const color = colorMap[confidence] ?? 'var(--muted)'
  return (
    <span
      className="inline-flex items-center font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded border"
      style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)`, borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}
    >
      {confidence} confidence
    </span>
  )
}

interface AlertDetailProps {
  alert: AlertRecord
  similar: AlertRecord[]
}

export default function AlertDetail({ alert, similar }: AlertDetailProps) {
  const [expanded, setExpanded] = useState(false)

  const lv = alert.llm_verdict ?? null
  const sev = resolveSeverity(lv, alert.rule_level)
  const { bg: sevBg, label: sevLabel, text: sevText } = SEV_MAP[sev]
  const hasVerdict = lv !== null

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-6 py-7" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5">

        <div className="fade-up-1">
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] transition-colors duration-150"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
          >
            ← Back to alerts
          </Link>
        </div>

        {!hasVerdict && (
          <div
            className="fade-up-1 rounded-[10px] px-4 py-3 flex items-center gap-2.5 font-mono text-[12px]"
            style={{ background: 'var(--accent-dim)', border: '1px solid rgba(88,166,255,0.20)', color: 'var(--accent)' }}
          >
            <span>ℹ</span>
            <span>Detailed analysis not available for this alert.</span>
          </div>
        )}

        <div
          className="fade-up-2 rounded-[12px] px-6 py-5 flex items-center gap-4"
          style={{ background: sevBg }}
        >
          <div className="text-[22px] font-bold tracking-tight" style={{ color: sevText, letterSpacing: '-0.02em' }}>
            {sevLabel}
          </div>
          <div className="ml-auto font-mono text-[12px] opacity-80" style={{ color: sevText }}>
            rule level {alert.rule_level ?? '?'} / 15
          </div>
        </div>

        <div className="fade-up-3">
          <Card title="What happened?" accent={sevBg}>
            <p className="text-[18px] font-semibold leading-snug m-0" style={{ color: 'var(--text)', fontFamily: 'var(--font-syne)', letterSpacing: '-0.01em' }}>
              {lv?.plain_english_summary ?? alert.rule_desc ?? 'An alert was detected on your system.'}
            </p>
            {lv?.reason && (
              <p className="font-mono text-[12px] mt-3 m-0" style={{ color: 'var(--muted)' }}>{lv.reason}</p>
            )}
          </Card>
        </div>

        {hasVerdict && lv.damage_explanation && (
          <div className="fade-up-4">
            <Card title="Why does this matter?" accent={sevBg}>
              <p className="text-[15px] leading-relaxed m-0" style={{ color: 'var(--text)' }}>
                {lv.damage_explanation}
              </p>
              {(sev === 'low' || sev === 'medium') && (
                <p className="font-mono text-[12px] mt-3 m-0" style={{ color: 'var(--muted)' }}>
                  💡 This type of alert is common and does not necessarily mean your system is compromised.
                </p>
              )}
            </Card>
          </div>
        )}

        <div className="fade-up-5">
          <Card title="What should you do?" accent={sevBg}>
            {lv?.verdict === 'benign' ? (
              <p className="text-[15px] font-semibold m-0" style={{ color: 'var(--green)' }}>
                ✅ No action needed. We&apos;re keeping an eye on it.
              </p>
            ) : (
              <p className="text-[15px] leading-relaxed m-0 font-semibold" style={{ color: 'var(--text)' }}>
                {lv?.suggested_action ?? genericAction(alert.rule_level)}
              </p>
            )}
          </Card>
        </div>

        <div className="fade-up-6">
          <div className="rounded-[12px] overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 transition-colors duration-100"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>Technical details</span>
              <span className="font-mono text-[12px]">{expanded ? '↑ Hide' : '↓ Show'}</span>
            </button>

            {expanded && (
              <div className="px-5 pb-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    ['Alert ID', String(alert.id)],
                    ['Detected on', alert.agent_name ?? '—'],
                    ['Timestamp', formatTimestamp(alert.created_at)],
                    ['Agent IP', alert.agent_ip ?? '—'],
                    ['Status', null],
                    ['Retries', String(alert.retry_count)],
                  ].map(([k, v]) =>
                    v === null ? (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{k}</span>
                        <StatusBadge status={alert.status} />
                      </div>
                    ) : (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{k}</span>
                        <span className="font-mono text-[12px] break-all" style={{ color: 'var(--text)' }}>{v}</span>
                      </div>
                    )
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Rule level</span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--text)' }}>{alert.rule_level ?? 0} / 15</span>
                  </div>
                  <div style={{ background: 'var(--border-2)', borderRadius: 4, height: 6, width: '100%' }}>
                    <div style={{ width: `${Math.min(100, ((alert.rule_level ?? 0) / 15) * 100)}%`, background: sevBg, borderRadius: 4, height: '100%', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {alert.rule_desc && (
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Rule description</span>
                    <code className="font-mono text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>{alert.rule_desc}</code>
                  </div>
                )}

                {alert.iocs && alert.iocs.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                      Indicators of Compromise ({alert.iocs.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {alert.iocs.map((ioc, i) => (
                        <IocPill key={i} type={ioc.type} value={ioc.value} verdict={ioc.verdict} />
                      ))}
                    </div>
                  </div>
                )}

                {lv?.confidence && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>AI analysis confidence:</span>
                    <ConfidenceBadge confidence={lv.confidence} />
                  </div>
                )}

                {(alert.username || alert.command) && (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    {alert.username && (
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>User</span>
                        <span className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>{alert.username}</span>
                      </div>
                    )}
                    {alert.command && (
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Command</span>
                        <code className="font-mono text-[11px] break-all" style={{ color: 'var(--text)' }}>{alert.command}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <div className="fade-up-6 flex flex-col gap-3">
            <div className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>Recent similar alerts</div>
            <div className="flex flex-col gap-2">
              {similar.map((s) => (
                <Link
                  key={s.id}
                  href={`/alerts/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-[10px] no-underline transition-colors duration-100"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div className="flex items-center gap-3">
                    <SeverityChip level={s.rule_level} />
                    <span className="text-[13px] font-semibold truncate max-w-[340px]" style={{ color: 'var(--text)' }}>
                      {s.rule_desc ?? s.rule_id ?? `Alert #${s.id}`}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] shrink-0 ml-4" style={{ color: 'var(--muted)' }}>
                    {formatTimestamp(s.created_at)} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
