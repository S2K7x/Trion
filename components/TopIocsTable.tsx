import type { TopIoc } from '@/lib/types'

interface TopIocsTableProps {
  iocs: TopIoc[]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function TopIocsTable({ iocs }: TopIocsTableProps) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded p-4">
      <div className="text-[#555555] text-xs font-mono uppercase tracking-widest mb-3">
        top malicious iocs · last 7d
      </div>

      {iocs.length === 0 ? (
        <div className="text-[#333333] text-xs font-mono py-8 text-center">
          no malicious iocs detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[#444444] border-b border-[#1e1e1e]">
                <th className="text-left py-1 pr-3 font-normal">ioc</th>
                <th className="text-left py-1 pr-3 font-normal">type</th>
                <th className="text-right py-1 pr-3 font-normal">hits</th>
                <th className="text-left py-1 font-normal">last seen</th>
              </tr>
            </thead>
            <tbody>
              {iocs.map((ioc, i) => (
                <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                  <td className="py-1.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] flex-shrink-0" />
                      <span
                        className="text-[#e5e5e5] truncate max-w-[140px] block"
                        title={ioc.ioc_value}
                      >
                        {ioc.ioc_value}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-[#777777]">{ioc.ioc_type}</td>
                  <td className="py-1.5 pr-3 text-right text-[#ef4444] font-semibold">
                    {ioc.occurrences}
                  </td>
                  <td className="py-1.5 text-[#555555]">{formatDate(ioc.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
