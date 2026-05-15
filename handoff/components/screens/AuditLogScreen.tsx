// handoff/components/screens/AuditLogScreen.tsx
//
// Immutable append-only log. Each row carries an action color, sequential
// number, and a SHA-256 prefix hash. Read-only feel — DM Mono throughout.
//
// Visual reference: see Trion.html → "Audit Log" screen.

import { PageHeader } from '@/components/primitives/PageHeader'
import { Button } from '@/components/primitives/Button'
import { getAuditLog } from '@/lib/queries'
import type { AuditEvent } from '@/lib/types'

function actionColor(action: string): string {
  if (action.startsWith('alert.triaged'))     return 'var(--green)'
  if (action.startsWith('alert.suppressed'))  return 'var(--yellow)'
  if (action.includes('error') || action.startsWith('alert.requeued')) return 'var(--red)'
  if (action.startsWith('config'))            return 'var(--orange)'
  if (action.startsWith('auth'))              return 'var(--accent)'
  return 'var(--text)'
}

function isAgent(actor: string) {
  return actor === 'system' || actor.startsWith('soc-')
}

export async function AuditLogScreen({ searchParams = {} }: { searchParams?: { actor?: string; q?: string } }) {
  const rows: AuditEvent[] = await getAuditLog({
    actor: searchParams.actor ?? 'all',
    q:     searchParams.q ?? '',
    limit: 100,
  })

  return (
    <div className="px-8 py-7">
      <PageHeader
        title="Audit Log"
        subtitle={`${rows.length} events · append-only · SHA-256 chained`}
        right={
          <>
            <Button kind="ghost">export NDJSON</Button>
            <Button kind="ghost">verify chain</Button>
          </>
        }
      />

      {/* Banner */}
      <div className="fade-up-2 mb-4 px-3.5 py-2.5 rounded-[8px] flex items-center gap-2.5"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)' }}>
        <span className="text-[12px]" style={{ color: 'var(--accent)' }}>◆</span>
        <span className="font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
          immutable append-only log. all entries hash-chained.{' '}
          <span style={{ color: 'var(--text)' }}>last block: <span style={{ color: 'var(--accent)' }}>0x8a3f…d1c2</span></span>
          {' '}· verified just now
        </span>
      </div>

      <div className="fade-up-3 rounded-[12px] font-mono"
           style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {/* Header */}
        <div className="grid items-center py-2.5"
             style={{ gridTemplateColumns: '180px 90px 130px 160px 1fr 80px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <div className="px-4">timestamp</div><div>seq</div><div>actor</div><div>action</div><div>target · meta</div><div>hash</div>
        </div>

        {rows.map((e, i) => {
          const ts = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 19)
          return (
            <div key={e.id}
                 className="grid items-center py-2 transition-colors hover:bg-[var(--surface-2)]"
                 style={{ gridTemplateColumns: '180px 90px 130px 160px 1fr 80px', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
              <div className="px-4" style={{ color: 'var(--muted)' }}>{ts}<span style={{ color: 'var(--dim)' }}>Z</span></div>
              <div style={{ color: 'var(--dim)' }}>#{e.id}</div>
              <div style={{ color: isAgent(e.actor) ? 'var(--accent)' : 'var(--text)' }}>{e.actor}</div>
              <div style={{ color: actionColor(e.action) }}>{e.action}</div>
              <div className="truncate pr-4" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--text)' }}>{e.target}</span>
                {e.meta && <span style={{ color: 'var(--dim)' }}> · {e.meta}</span>}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--accent)' }}>{e.hash}</div>
            </div>
          )
        })}

        <div className="px-4 py-3 flex justify-between items-center text-[10px]"
             style={{ borderTop: '1px solid var(--border)', color: 'var(--dim)' }}>
          <span>showing {rows.length} entries</span>
          <span>retention · 90d · ↓ load older</span>
        </div>
      </div>
    </div>
  )
}
