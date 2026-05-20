import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Belt-and-suspenders JWT check (middleware already guards this path)
  const token = request.cookies.get('dashboard_session')?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const secret = new TextEncoder().encode(process.env.DASHBOARD_SECRET!)
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('alert_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      console.error('[api:alerts:get]', error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[api:alerts:get] unexpected', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
