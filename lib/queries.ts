import { createServerSupabase } from './supabase-server'
import type {
  AlertRecord,
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
      .select(
        'id, created_at, rule_id, rule_desc, rule_level, agent_name, agent_ip, username, command, iocs, raw_alert, status, retry_count, processed_at'
      )
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
