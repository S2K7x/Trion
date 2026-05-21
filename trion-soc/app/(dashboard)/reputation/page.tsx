import { Suspense } from 'react'
import { searchReputation } from '@/lib/queries'
import { IocPill } from '@/components/primitives/IocPill'
import { SeverityChip } from '@/components/primitives/SeverityChip'
import { StatusBadge } from '@/components/primitives/StatusBadge'
import { ReputationSearch } from '@/components/ReputationSearch'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function sp(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export default async function ReputationPage({ searchParams }: PageProps) {
  const q = sp(searchParams.q) ?? ''
  const result = q ? await searchReputation(q) : null

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1">
        <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Reputation</div>
        <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
          Look up an IP, hash, or domain across collected alerts
        </div>
      </div>

      <div className="fade-up-2">
        <Suspense>
          <ReputationSearch initialQ={q} />
        </Suspense>
      </div>

      {result && (
        <div className="fade-up-3 flex flex-col gap-4">
          {/* Verdict summary */}
          <div
            className="rounded-[12px] p-5 flex items-center gap-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {result.ioc_type && (
              <IocPill type={result.ioc_type} value={q} verdict={result.verdict ?? undefined} />
            )}
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{q}</div>
              <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {result.matches.length} alert{result.matches.length !== 1 ? 's' : ''} matched ·{' '}
                {result.verdict
                  ? <span style={{ color: result.verdict === 'MALICIOUS' ? 'var(--red)' : 'var(--orange)' }}>{result.verdict}</span>
                  : 'no verdict'}
              </div>
            </div>
          </div>

          {result.matches.length === 0 ? (
            <div
              className="rounded-[12px] py-12 text-center font-mono text-[12px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              no alerts found for &ldquo;{q}&rdquo;
            </div>
          ) : (
            <div
              className="rounded-[12px] overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                  Matching alerts
                </div>
              </div>
              {result.matches.map((alert, i) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-4 px-5 py-3"
                  style={{ borderBottom: i < result.matches.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                        {alert.rule_desc ?? alert.rule_id ?? '—'}
                      </span>
                      <SeverityChip level={alert.rule_level} />
                      <StatusBadge status={alert.status} />
                    </div>
                    <div className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                      {alert.agent_name ?? '—'} · {formatTime(alert.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && (
        <div
          className="fade-up-3 rounded-[12px] py-16 text-center font-mono text-[12px]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          enter an IP, domain, hash, or URL above to search
        </div>
      )}
    </main>
  )
}
