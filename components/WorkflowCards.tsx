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
  } catch {
    return '—'
  }
}

function WorkflowCard({ workflow }: { workflow: WorkflowStatus }) {
  const unreachable = !workflow.active && workflow.last_exec === null

  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded p-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
            workflow.active ? 'bg-[#22c55e] animate-pulse' : 'bg-[#ef4444]'
          }`}
        />
        <span className="text-[#e5e5e5] text-xs font-mono font-semibold truncate">
          {workflow.name}
        </span>
      </div>
      <div className="text-[#555555] text-xs font-mono">
        {unreachable ? (
          <span className="text-[#eab308]">n8n unreachable</span>
        ) : workflow.active ? (
          <span className="text-[#22c55e]">active</span>
        ) : (
          <span className="text-[#ef4444]">inactive</span>
        )}
      </div>
      {!unreachable && (
        <div className="text-[#444444] text-xs font-mono mt-1">
          last exec: {timeAgo(workflow.last_exec)}
        </div>
      )}
    </div>
  )
}

export function WorkflowCards({ workflows }: WorkflowCardsProps) {
  const allUnreachable = workflows.every((w) => !w.active && w.last_exec === null)

  return (
    <div className="bg-[#111111] border border-[#222222] rounded p-4">
      <div className="text-[#555555] text-xs font-mono uppercase tracking-widest mb-3">
        n8n workflows
      </div>

      {allUnreachable && (
        <div className="mb-3 px-3 py-2 bg-[#1a1500] border border-[#3a2e00] rounded text-[#eab308] text-xs font-mono">
          ⚠ n8n unreachable — check Cloudflare Tunnel
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {workflows.map((wf) => (
          <WorkflowCard key={wf.name} workflow={wf} />
        ))}
      </div>
    </div>
  )
}
