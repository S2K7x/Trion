import { NextRequest, NextResponse } from 'next/server'
import { getAlertById } from '@/lib/queries'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const alert = await getAlertById(id)
  if (!alert) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(alert)
}
