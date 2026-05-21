import { SignJWT } from 'jose'
import { createHash, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Hash both strings to fixed-length SHA-256 digests before constant-time comparison.
// This prevents the timing side-channel that leaks password length when comparing raw strings.
function safeCompare(a: string, b: string): boolean {
  try {
    const aHash = createHash('sha256').update(a, 'utf8').digest()
    const bHash = createHash('sha256').update(b, 'utf8').digest()
    return timingSafeEqual(aHash, bHash)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const dashboardPassword = process.env.DASHBOARD_PASSWORD
  const dashboardSecret = process.env.DASHBOARD_SECRET

  if (!dashboardPassword || !dashboardSecret) {
    console.error('[auth] DASHBOARD_PASSWORD or DASHBOARD_SECRET env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { password } = body as { password?: unknown }

  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  if (!safeCompare(password, dashboardPassword)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const secret = new TextEncoder().encode(dashboardSecret)
  const token = await new SignJWT({ sub: 'dashboard' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  const cookieStore = cookies()
  cookieStore.set('dashboard_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
