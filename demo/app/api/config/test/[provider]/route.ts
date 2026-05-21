import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: { provider: string } }
) {
  return NextResponse.json({
    success: true,
    message: `${params.provider} connection OK (demo mode)`,
  })
}
