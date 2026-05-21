import type { AlertRecord, TopIoc, WorkflowStatus, StatsResponse } from './types'
import {
  MOCK_ALERTS,
  MOCK_IOCS,
  MOCK_WORKFLOWS,
  MOCK_STATS,
} from './mock-data'

export interface AlertFilters {
  page?: number
  pageSize?: number
  severity?: string
  status?: string
  q?: string
  range?: string
}

export async function getDashboardStats(): Promise<StatsResponse> {
  return MOCK_STATS
}

export async function getAlertsPaginated(
  opts: AlertFilters = {}
): Promise<{ alerts: AlertRecord[]; total: number }> {
  const { page = 0, pageSize = 25, severity, status, q, range } = opts

  const rangeMs =
    range === '1h'  ? 3_600_000
    : range === '7d'  ? 7 * 86_400_000
    : range === '30d' ? 30 * 86_400_000
    : 86_400_000
  const since = Date.now() - rangeMs

  let results = MOCK_ALERTS.filter(
    (a) => new Date(a.created_at).getTime() >= since
  )

  if (status && status !== 'all') {
    results = results.filter((a) => a.status === status)
  }
  if (severity && severity !== 'all') {
    if (severity === 'critical') results = results.filter((a) => (a.rule_level ?? 0) >= 15)
    else if (severity === 'high')   results = results.filter((a) => (a.rule_level ?? 0) >= 12 && (a.rule_level ?? 0) <= 14)
    else if (severity === 'medium') results = results.filter((a) => (a.rule_level ?? 0) >= 7  && (a.rule_level ?? 0) <= 11)
    else if (severity === 'low')    results = results.filter((a) => (a.rule_level ?? 0) <= 6)
  }
  if (q) {
    const lq = q.toLowerCase()
    results = results.filter(
      (a) =>
        a.rule_desc?.toLowerCase().includes(lq) ||
        a.rule_id?.toLowerCase().includes(lq) ||
        a.agent_name?.toLowerCase().includes(lq)
    )
  }

  const total = results.length
  const alerts = results.slice(page * pageSize, (page + 1) * pageSize)
  return { alerts, total }
}

export async function getAlertById(id: string): Promise<AlertRecord | null> {
  return MOCK_ALERTS.find((a) => a.id === id) ?? null
}

export async function getSimilarAlerts(ruleId: string, excludeId: string): Promise<AlertRecord[]> {
  if (!ruleId) return []
  return MOCK_ALERTS.filter((a) => a.rule_id === ruleId && a.id !== excludeId).slice(0, 3)
}

export async function getTopIocs(): Promise<TopIoc[]> {
  return MOCK_IOCS
}

export async function getWorkflows(): Promise<WorkflowStatus[]> {
  return MOCK_WORKFLOWS
}

export async function getTimeline(opts: { range?: string } = {}): Promise<AlertRecord[]> {
  const rangeMs =
    opts.range === '1h'  ? 3_600_000
    : opts.range === '7d'  ? 7 * 86_400_000
    : opts.range === '30d' ? 30 * 86_400_000
    : 86_400_000
  const since = Date.now() - rangeMs
  return MOCK_ALERTS.filter(
    (a) => new Date(a.created_at).getTime() >= since
  ).slice(0, 200)
}

export async function searchReputation(indicator: string): Promise<{
  matches: AlertRecord[]
  verdict: string | null
  ioc_type: string | null
}> {
  if (!indicator.trim()) return { matches: [], verdict: null, ioc_type: null }

  const lq = indicator.toLowerCase()
  const matches = MOCK_ALERTS.filter(
    (a) => a.iocs?.some((ioc) => ioc.value.toLowerCase() === lq)
  )

  let verdict: string | null = null
  let ioc_type: string | null = null
  for (const alert of matches) {
    const ioc = alert.iocs?.find((i) => i.value.toLowerCase() === lq)
    if (ioc) {
      verdict = ioc.verdict ?? null
      ioc_type = ioc.type ?? null
      break
    }
  }
  return { matches, verdict, ioc_type }
}

export async function getQueueDepth(): Promise<number> {
  return 12
}
