import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = cookies()
  cookieStore.delete('dashboard_session')
  return NextResponse.json({ ok: true })
}
