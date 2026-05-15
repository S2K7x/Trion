import type { TopIoc } from '@/lib/types'

interface TopIocsTableProps {
  iocs: TopIoc[]
}


const TYPE_LABEL: Record<string, string> = {
  ip:     'IP',
  hash:   'MD5',
  domain: 'URL',
  url:    'URL',
}

function typeStyle(type: string): { bg: string; color: string; label: string } {
  const t = type.toLowerCase()
  const label = TYPE_LABEL[t] ?? type.slice(0, 3).toUpperCase()
  if (t === 'ip')   return { bg: 'var(--accent-dim)', color: 'var(--accent)',  label }
  if (t === 'hash') return { bg: 'var(--yellow-dim)', color: 'var(--yellow)', label }
  return                   { bg: 'var(--red-dim)',    color: 'var(--red)',     label }
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
          {iocs.map((ioc, i) => {
            const ts = typeStyle(ioc.ioc_type)
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-100 cursor-pointer hover:bg-[#1c2330]"
                style={{ borderBottom: i < iocs.length - 1 ? '1px solid var(--border)' : undefined }}
              >
                <span
                  className="font-mono text-[9px] font-medium tracking-[0.06em] uppercase px-1.5 py-0.5 rounded shrink-0 w-8 text-center"
                  style={{ background: ts.bg, color: ts.color }}
                >
                  {ts.label}
                </span>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
