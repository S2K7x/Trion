import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stats = await getDashboardStats()
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
