import { getTopIocs } from '@/lib/queries'
import { IocPill } from '@/components/primitives/IocPill'

export const dynamic = 'force-dynamic'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function scoreColor(occ: number): string {
  if (occ >= 5) return 'var(--red)'
  if (occ >= 2) return 'var(--yellow)'
  return 'var(--green)'
}

export default async function IocsPage() {
  const iocs = await getTopIocs()

  return (
    <main className="overflow-y-auto flex flex-col gap-5 px-8 py-7" style={{ background: 'var(--bg)' }}>
      <div className="fade-up-1">
        <div className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>IOCs</div>
        <div className="font-mono text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
          Top {iocs.length} malicious indicators · last 7 days
        </div>
      </div>

      <div
        className="fade-up-2 rounded-[12px] overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {iocs.length === 0 ? (
          <div className="font-mono text-[12px] py-16 text-center" style={{ color: 'var(--muted)' }}>
            no malicious IOCs detected in the last 7 days
          </div>
        ) : (
          <>
            <div style={{ borderBottom: '1px solid var(--border)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Type', 'Indicator', 'Verdict', 'Hits', 'Last seen'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 font-mono text-[10px] font-medium tracking-[0.08em] uppercase"
                        style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {iocs.map((ioc, i) => (
                    <tr
                      key={i}
                      className="transition-colors duration-100 hover:bg-trion-surface2"
                      style={{ borderBottom: i < iocs.length - 1 ? '1px solid var(--border)' : undefined }}
                    >
                      <td className="px-5 py-3 align-middle">
                        <IocPill type={ioc.ioc_type} value="" verdict={ioc.verdict} dense />
                      </td>
                      <td className="px-5 py-3 align-middle font-mono text-[12px] max-w-[320px] truncate" style={{ color: 'var(--text)' }}>
                        {ioc.ioc_value}
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <span
                          className="font-mono text-[10px] font-medium tracking-[0.04em] px-2 py-0.5 rounded"
                          style={
                            ioc.verdict === 'MALICIOUS'
                              ? { background: 'var(--red-dim)', color: 'var(--red)' }
                              : ioc.verdict === 'SUSPICIOUS'
                              ? { background: 'var(--orange-dim)', color: 'var(--orange)' }
                              : { background: 'var(--surface-2)', color: 'var(--muted)' }
                          }
                        >
                          {ioc.verdict ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-middle font-mono text-[12px] font-semibold" style={{ color: scoreColor(ioc.occurrences) }}>
                        ×{ioc.occurrences}
                      </td>
                      <td className="px-5 py-3 align-middle font-mono text-[11px]" style={{ color: 'var(--muted)' }}>
                        {formatDate(ioc.last_seen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
