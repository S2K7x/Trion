import { createServerSupabase } from './supabase-server'
import type {
  AlertRecord,
  AlertStatus,
  DashboardCounters,
  TrendPoint,
  TopRule,
  TopIoc,
  WorkflowStatus,
  StatsResponse,
} from './types'

const WORKFLOW_NAMES = ['soc-ingest', 'soc-triage', 'soc-error-handler']

const FALLBACK_WORKFLOWS: WorkflowStatus[] = WORKFLOW_NAMES.map((name) => ({
  name,
  active: false,
  last_exec: null,
}))

async function fetchWorkflows(): Promise<WorkflowStatus[]> {
  const apiUrl = process.env.N8N_API_URL
  const apiKey = process.env.N8N_API_KEY

  if (!apiUrl || !apiKey) {
    return FALLBACK_WORKFLOWS
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`n8n responded ${res.status}`)

    const body = (await res.json()) as {
      data: Array<{ name: string; active: boolean; updatedAt: string }>
    }

    return WORKFLOW_NAMES.map((name) => {
      const wf = body.data.find((w) => w.name === name)
      return {
        name,
        active: wf?.active ?? false,
        last_exec: wf?.updatedAt ?? null,
      }
    })
  } catch (err) {
    console.error('[queries:workflows]', err instanceof Error ? err.message : err)
    return FALLBACK_WORKFLOWS
  }
}

export async function getDashboardStats(): Promise<StatsResponse> {
  const supabase = createServerSupabase()
  const since24h = new Date(Date.now() - 86_400_000).toISOString()

  const [
    todayRes,
    queueRes,
    criticalRes,
    errorRateRes,
    trendRes,
    recentRes,
    topRulesRes,
    topIocsRes,
    workflows,
  ] = await Promise.all([
    supabase
      .from('alert_queue')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', since24h),

    supabase
      .from('alert_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('alert_queue')
      .select('*', { count: 'exact', head: true })
      .gte('rule_level', 12)
      .gt('created_at', since24h),

    supabase.rpc('get_error_rate'),

    supabase.rpc('get_dashboard_trend'),

    supabase
      .from('alert_queue')
      .select(ALERT_SELECT)
      .order('created_at', { ascending: false })
      .limit(50),

    supabase.rpc('get_top_rules'),

    supabase.rpc('get_top_iocs'),

    fetchWorkflows(),
  ])

  // Log any Supabase-level errors for observability — fallbacks below keep the dashboard functional.
  const labeledResults: Array<[string, { error: { message: string } | null }]> = [
    ['today', todayRes],
    ['queue', queueRes],
    ['critical', criticalRes],
    ['error-rate', errorRateRes],
    ['trend', trendRes],
    ['recent', recentRes],
    ['top-rules', topRulesRes],
    ['top-iocs', topIocsRes],
  ]
  for (const [label, res] of labeledResults) {
    if (res.error) {
      console.error(`[queries:${label}] ${res.error.message}`)
    }
  }

  const counters: DashboardCounters = {
    today: todayRes.count ?? 0,
    queue_depth: queueRes.count ?? 0,
    critical: criticalRes.count ?? 0,
    error_rate:
      (errorRateRes.data as Array<{ error_rate: number | null }> | null)?.[0]?.error_rate ?? 0,
  }

  return {
    counters,
    trend: (trendRes.data as TrendPoint[] | null) ?? [],
    recent_alerts: (recentRes.data as AlertRecord[] | null) ?? [],
    top_rules: (topRulesRes.data as TopRule[] | null) ?? [],
    top_iocs: (topIocsRes.data as TopIoc[] | null) ?? [],
    workflows,
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALERT_SELECT =
  'id, created_at, rule_id, rule_desc, rule_level, agent_name, agent_ip, username, command, iocs, raw_alert, status, retry_count, processed_at, llm_verdict'

function rangeToDate(range?: string): string {
  const ms =
    range === '1h' ? 3_600_000
    : range === '7d' ? 7 * 86_400_000
    : range === '30d' ? 30 * 86_400_000
    : 86_400_000 // default 24h
  return new Date(Date.now() - ms).toISOString()
}

// ─── exported query functions ─────────────────────────────────────────────────

export interface AlertFilters {
  page?: number
  pageSize?: number
  severity?: string
  status?: string
  q?: string
  range?: string
}

export async function getAlertsPaginated(
  opts: AlertFilters = {}
): Promise<{ alerts: AlertRecord[]; total: number }> {
  const supabase = createServerSupabase()
  const { page = 0, pageSize = 25, severity, status, q, range } = opts
  const since = rangeToDate(range)

  // eslint-disable-next-line prefer-const
  let query = supabase
    .from('alert_queue')
    .select(ALERT_SELECT, { count: 'exact' })
    .gt('created_at', since)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status as AlertStatus)
  }
  if (q) {
    query = query.or(`rule_desc.ilike.%${q}%,rule_id.ilike.%${q}%,agent_name.ilike.%${q}%`)
  }
  if (severity && severity !== 'all') {
    if (severity === 'critical') query = query.gte('rule_level', 15)
    else if (severity === 'high') query = query.gte('rule_level', 12).lte('rule_level', 14)
    else if (severity === 'medium') query = query.gte('rule_level', 7).lte('rule_level', 11)
    else if (severity === 'low') query = query.lte('rule_level', 6)
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, count, error } = await query
  if (error) console.error('[queries:alerts-paginated]', error.message)

  return {
    alerts: (data as AlertRecord[] | null) ?? [],
    total: count ?? 0,
  }
}

export async function getTopIocs(): Promise<TopIoc[]> {
  const supabase = createServerSupabase()
  const { data, error } = await supabase.rpc('get_top_iocs')
  if (error) console.error('[queries:top-iocs]', error.message)
  return (data as TopIoc[] | null) ?? []
}

export async function getWorkflows(): Promise<WorkflowStatus[]> {
  return fetchWorkflows()
}

export async function getTimeline(opts: { range?: string } = {}): Promise<AlertRecord[]> {
  const supabase = createServerSupabase()
  const since = rangeToDate(opts.range)
  const { data, error } = await supabase
    .from('alert_queue')
    .select(ALERT_SELECT)
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) console.error('[queries:timeline]', error.message)
  return (data as AlertRecord[] | null) ?? []
}

export async function searchReputation(indicator: string): Promise<{
  matches: AlertRecord[]
  verdict: string | null
  ioc_type: string | null
}> {
  if (!indicator.trim()) return { matches: [], verdict: null, ioc_type: null }

  const supabase = createServerSupabase()
  // Use PostgREST 'cs' operator = JSONB @> (contains)
  const { data, error } = await supabase
    .from('alert_queue')
    .select(ALERT_SELECT)
    .filter('iocs', 'cs', JSON.stringify([{ value: indicator }]))
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) console.error('[queries:reputation]', error.message)

  const matches = (data as AlertRecord[] | null) ?? []
  let verdict: string | null = null
  let ioc_type: string | null = null
  for (const alert of matches) {
    const ioc = alert.iocs?.find((i) => i.value === indicator)
    if (ioc) {
      verdict = ioc.verdict ?? null
      ioc_type = ioc.type ?? null
      break
    }
  }
  return { matches, verdict, ioc_type }
}

export async function getAlertById(id: string): Promise<AlertRecord | null> {
  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('alert_queue')
    .select(ALERT_SELECT)
    .eq('id', id)
    .single()
  if (error) {
    console.error('[queries:alert-by-id]', error.message)
    return null
  }
  return data as AlertRecord | null
}

export async function getSimilarAlerts(ruleId: string, excludeId: string): Promise<AlertRecord[]> {
  if (!ruleId) return []
  const supabase = createServerSupabase()
  const { data, error } = await supabase
    .from('alert_queue')
    .select(ALERT_SELECT)
    .eq('rule_id', ruleId)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(3)
  if (error) {
    console.error('[queries:similar-alerts]', error.message)
    return []
  }
  return (data as AlertRecord[] | null) ?? []
}

export async function getQueueDepth(): Promise<number> {
  const supabase = createServerSupabase()
  const { count } = await supabase
    .from('alert_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}
