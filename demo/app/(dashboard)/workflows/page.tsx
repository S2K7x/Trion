import { getWorkflows } from '@/lib/queries'
import { WorkflowCards } from '@/components/WorkflowCards'

export const dynamic = 'force-dynamic'

export default async function WorkflowsPage() {
  const workflows = await getWorkflows()

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1">
        <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Workflows</div>
        <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
          n8n automation pipeline status
        </div>
      </div>

      <div className="fade-up-2 max-w-lg">
        <WorkflowCards workflows={workflows} />
      </div>
    </main>
  )
}
