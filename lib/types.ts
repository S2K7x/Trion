export type AlertStatus = 'pending' | 'done' | 'error' | 'processing'

export interface Ioc {
  value: string
  type: string
  verdict: string
}

export interface AlertRecord {
  id: string
  created_at: string
  rule_id: string | null
  rule_desc: string | null
  rule_level: number | null
  agent_name: string | null
  agent_ip: string | null
  username: string | null
  command: string | null
  iocs: Ioc[]
  raw_alert: Record<string, unknown>
  status: AlertStatus
  retry_count: number
  processed_at: string | null
}

export interface TrendPoint {
  hour: string
  count: number
  critical: number
}

export interface TopRule {
  rule_id: string
  rule_desc: string
  count: number
}

export interface TopIoc {
  ioc_value: string
  ioc_type: string
  verdict: string
  occurrences: number
  last_seen: string
}

export interface WorkflowStatus {
  name: string
  active: boolean
  last_exec: string | null
}

export interface DashboardCounters {
  today: number
  queue_depth: number
  critical: number
  error_rate: number
}

export interface StatsResponse {
  counters: DashboardCounters
  trend: TrendPoint[]
  recent_alerts: AlertRecord[]
  top_rules: TopRule[]
  top_iocs: TopIoc[]
  workflows: WorkflowStatus[]
}
