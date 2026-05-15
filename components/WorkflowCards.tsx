'use client'

import type { WorkflowStatus } from '@/lib/types'

interface WorkflowCardsProps {
  workflows: WorkflowStatus[]
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  } catch { return '—' }
}

function WorkflowCard({ workflow }: { workflow: WorkflowStatus }) {
  const unreachable = !workflow.active && workflow.last_exec === null

  return (
    <div
      className="flex items-center gap-3 px-5 py-[11px]"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${workflow.active ? 'animate-trion-pulse' : ''}`}
        style={{ background: workflow.active ? 'var(--green)' : unreachable ? 'var(--yellow)' : 'var(--red)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>
          {workflow.name}
        </div>
        <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
          {unreachable ? 'n8n unreachable' : workflow.active ? 'active' : 'inactive'}
        </div>
      </div>
      <div className="font-mono text-[10px] shrink-0" style={{ color: 'var(--muted)' }}>
        {unreachable ? '—' : timeAgo(workflow.last_exec)}
      </div>
    </div>
  )
}

export function WorkflowCards({ workflows }: WorkflowCardsProps) {
  const allUnreachable = workflows.every((w) => !w.active && w.last_exec === null)

  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          n8n Workflows
        </div>
      </div>

      {allUnreachable && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-[8px] font-mono text-[11px]"
          style={{ background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.20)', color: 'var(--yellow)' }}
        >
          ⚠ n8n unreachable — check Cloudflare Tunnel
        </div>
      )}

      <div>
        {workflows.map((wf, i) => (
          <div
            key={wf.name}
            style={i === workflows.length - 1 ? {} : undefined}
          >
            <WorkflowCard workflow={wf} />
          </div>
        ))}
        {workflows.length === 0 && (
          <div className="font-mono text-[12px] py-8 text-center" style={{ color: 'var(--border-2)' }}>
            no workflows
          </div>
        )}
      </div>
    </div>
  )
}
