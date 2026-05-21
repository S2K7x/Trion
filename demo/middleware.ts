import { jwtVerify } from 'jose'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_SECRET = new TextEncoder().encode(
  'trion-demo-jwt-secret-key-not-for-production-use-2026'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/health'
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('dashboard_session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, DEMO_SECRET, { algorithms: ['HS256'] })
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('dashboard_session')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
