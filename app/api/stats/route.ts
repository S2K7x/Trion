import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/queries'

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 12_000

export async function GET() {
  try {
    let timeoutId: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`getDashboardStats timed out after ${TIMEOUT_MS}ms`)),
        TIMEOUT_MS
      )
    })

    const stats = await Promise.race([getDashboardStats(), timeout])
    clearTimeout(timeoutId!)

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[stats]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
