import type { AlertStatus } from './types'

export type SeverityLabel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNK'

export interface Severity {
  label: SeverityLabel
  color: string
  glow: boolean
}

export function levelToSeverity(level: number | null | undefined): Severity {
  if (level == null) return { label: 'UNK', color: 'var(--muted)', glow: false }
  if (level >= 15)   return { label: 'CRITICAL', color: 'var(--red)',    glow: true  }
  if (level >= 12)   return { label: 'HIGH',     color: 'var(--orange)', glow: false }
  if (level >= 7)    return { label: 'MEDIUM',   color: 'var(--yellow)', glow: false }
  return               { label: 'LOW',      color: 'var(--green)',  glow: false }
}

export interface StatusStyle {
  bg: string
  color: string
  symbol: string
  pulse: boolean
}

export const STATUS_STYLES: Record<AlertStatus, StatusStyle> = {
  pending:    { bg: 'var(--yellow-dim)', color: 'var(--yellow)', symbol: '○', pulse: false },
  processing: { bg: 'var(--accent-dim)', color: 'var(--accent)', symbol: '●', pulse: true  },
  done:       { bg: 'var(--green-dim)',  color: 'var(--green)',  symbol: '✓', pulse: false },
  error:      { bg: 'var(--red-dim)',    color: 'var(--red)',    symbol: '✕', pulse: false },
}

export type IocType = 'IP' | 'MD5' | 'SHA256' | 'URL' | 'DOMAIN' | string

export function iocTypeStyle(type: IocType, verdict?: string) {
  const t = (type || '').toUpperCase()
  if (verdict === 'MALICIOUS')  return { c: 'var(--red)',    b: 'rgba(248,81,73,0.30)',  bg: 'var(--red-dim)' }
  if (verdict === 'SUSPICIOUS') return { c: 'var(--orange)', b: 'rgba(240,136,62,0.30)', bg: 'var(--orange-dim)' }
  if (t === 'IP')               return { c: 'var(--accent)', b: 'rgba(88,166,255,0.28)', bg: 'var(--accent-dim)' }
  if (t === 'MD5' || t === 'SHA256' || t === 'HASH')
                                return { c: 'var(--yellow)', b: 'rgba(210,153,34,0.28)', bg: 'var(--yellow-dim)' }
  if (t === 'URL' || t === 'DOMAIN')
                                return { c: 'var(--green)',  b: 'rgba(63,185,80,0.28)',  bg: 'var(--green-dim)' }
  return                          { c: 'var(--muted)', b: 'var(--border-2)',       bg: 'transparent' }
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const diff = now - new Date(iso).getTime()
  const s = Math.max(0, Math.floor(diff / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function scoreColor(value: number, total = 100): string {
  const p = value / total
  if (p >= 0.5)  return 'var(--red)'
  if (p >= 0.25) return 'var(--orange)'
  if (p >= 0.1)  return 'var(--yellow)'
  return            'var(--green)'
}
