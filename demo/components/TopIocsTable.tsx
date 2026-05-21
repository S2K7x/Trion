import type { TopIoc } from '@/lib/types'
import { IocPill } from '@/components/primitives/IocPill'

interface TopIocsTableProps {
  iocs: TopIoc[]
}

function scoreColor(occ: number): string {
  if (occ >= 5) return 'var(--red)'
  if (occ >= 2) return 'var(--yellow)'
  return 'var(--green)'
}

export function TopIocsTable({ iocs }: TopIocsTableProps) {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-[13px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
          Recent IOC hits
        </div>
        <span className="font-mono text-[12px]" style={{ color: 'var(--accent)' }}>
          7d
        </span>
      </div>

      {iocs.length === 0 ? (
        <div className="font-mono text-[12px] py-8 text-center" style={{ color: 'var(--border-2)' }}>
          no malicious iocs detected
        </div>
      ) : (
        <div>
          {iocs.map((ioc, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-100 hover:bg-trion-surface2"
              style={{ borderBottom: i < iocs.length - 1 ? '1px solid var(--border)' : undefined }}
            >
              <IocPill type={ioc.ioc_type} value="" verdict="MALICIOUS" dense />
              <span
                className="font-mono text-[11px] flex-1 truncate"
                style={{ color: 'var(--text)' }}
                title={ioc.ioc_value}
              >
                {ioc.ioc_value}
              </span>
              <span
                className="font-mono text-[11px] font-semibold shrink-0"
                style={{ color: scoreColor(ioc.occurrences) }}
              >
                ×{ioc.occurrences}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
