import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
