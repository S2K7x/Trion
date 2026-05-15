import { getWorkflows } from '@/lib/queries'
import { WorkflowCards } from '@/components/WorkflowCards'

export const dynamic = 'force-dynamic'

export default async function WorkflowsPage() {
  const workflows = await getWorkflows()
  const allUnreachable = workflows.every((w) => !w.active && w.last_exec === null)

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1">
        <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Workflows</div>
        <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
          n8n automation pipeline status
        </div>
      </div>

      {allUnreachable && (
        <div
          className="fade-up-2 px-4 py-3 rounded-[8px] font-mono text-[11px]"
          style={{ background: 'rgba(210,153,34,0.08)', border: '1px solid rgba(210,153,34,0.20)', color: 'var(--yellow)' }}
        >
          ⚠ n8n unreachable — check N8N_API_URL and Cloudflare Tunnel
        </div>
      )}

      <div className="fade-up-2 max-w-lg">
        <WorkflowCards workflows={workflows} />
      </div>
    </main>
  )
}
