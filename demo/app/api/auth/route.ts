import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_PASSWORD = 'demo'
const DEMO_SECRET = new TextEncoder().encode(
  'trion-demo-jwt-secret-key-not-for-production-use-2026'
)

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { password } = body as { password?: unknown }

  if (typeof password !== 'string' || password !== DEMO_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await new SignJWT({ sub: 'demo' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(DEMO_SECRET)

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
