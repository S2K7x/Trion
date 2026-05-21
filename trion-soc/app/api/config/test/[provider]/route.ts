import { NextRequest, NextResponse } from 'next/server'

const TIMEOUT_MS = 5000

const VALID_PROVIDERS = ['supabase', 'virustotal', 'abuseipdb', 'malwarebazaar', 'slack', 'llm']

function validateUrl(raw: string, allowLocalhost = false): string {
  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('Invalid URL') }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Only http/https allowed')
  }
  if (!allowLocalhost) {
    const host = parsed.hostname
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1|localhost)/i.test(host)) {
      throw new Error('Private/internal addresses not allowed')
    }
  }
  return raw
}

function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider } = params

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ success: false, message: 'Invalid provider' }, { status: 400 })
  }

  let body: Record<string, string> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 })
  }

  try {
    switch (provider) {
      /* ── Supabase ───────────────────────────────────────────── */
      case 'supabase': {
        const { url, key } = body
        if (!url || !key) return NextResponse.json({ success: false, message: 'url and key are required' })
        try { validateUrl(url, true) } catch (e: unknown) {
          return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 })
        }
        const res = await timedFetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        })
        if (res.ok || res.status === 400 || res.status === 404) {
          return NextResponse.json({ success: true, message: 'Connection successful' })
        }
        return NextResponse.json({ success: false, message: `HTTP ${res.status}: Check URL and service key` })
      }

      /* ── VirusTotal ─────────────────────────────────────────── */
      case 'virustotal': {
        const { key } = body
        if (!key) return NextResponse.json({ success: false, message: 'key is required' })
        const res = await timedFetch('https://www.virustotal.com/api/v3/urls', {
          headers: { 'x-apikey': key },
        })
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json({ success: false, message: 'Invalid API key' })
        }
        return NextResponse.json({ success: true, message: 'API key valid' })
      }

      /* ── AbuseIPDB ──────────────────────────────────────────── */
      case 'abuseipdb': {
        const { key } = body
        if (!key) return NextResponse.json({ success: false, message: 'key is required' })
        const res = await timedFetch('https://api.abuseipdb.com/api/v2/check?ipAddress=1.1.1.1', {
          headers: { Key: key, Accept: 'application/json' },
        })
        if (res.ok) return NextResponse.json({ success: true, message: 'API key valid' })
        return NextResponse.json({ success: false, message: `HTTP ${res.status}: Invalid key` })
      }

      /* ── MalwareBazaar ──────────────────────────────────────── */
      case 'malwarebazaar': {
        const res = await timedFetch('https://mb-api.abuse.ch/api/v1/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'query=get_info&hash=0000000000000000000000000000000000000000000000000000000000000000',
        })
        if (res.ok) return NextResponse.json({ success: true, message: 'MalwareBazaar reachable' })
        return NextResponse.json({ success: false, message: `HTTP ${res.status}` })
      }

      /* ── Slack ──────────────────────────────────────────────── */
      case 'slack': {
        const { url } = body
        if (!url) return NextResponse.json({ success: false, message: 'url is required' })
        try { validateUrl(url, false) } catch (e: unknown) {
          return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 })
        }
        const res = await timedFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '🔔 Trion SOC — webhook test successful' }),
        })
        const text = await res.text().catch(() => '')
        if (res.ok && text === 'ok') return NextResponse.json({ success: true, message: 'Webhook works' })
        if (!res.ok) return NextResponse.json({ success: false, message: `Slack error: ${text || res.status}` })
        return NextResponse.json({ success: true, message: 'Webhook reachable' })
      }

      /* ── LLM ────────────────────────────────────────────────── */
      case 'llm': {
        const { provider: llmProvider, endpoint, apiKey, model } = body

        if (llmProvider === 'ollama') {
          const raw = endpoint || 'http://localhost:11434'
          try { validateUrl(raw, true) } catch (e: unknown) {
            return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 })
          }
          const base = raw.replace(/\/$/, '')
          const res = await timedFetch(`${base}/api/tags`)
          if (res.ok) return NextResponse.json({ success: true, message: 'Ollama reachable' })
          return NextResponse.json({ success: false, message: `HTTP ${res.status}: Check endpoint` })
        }

        if (llmProvider === 'openai') {
          const raw = endpoint || 'https://api.openai.com/v1'
          try { validateUrl(raw, false) } catch (e: unknown) {
            return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 })
          }
          const base = raw.replace(/\/$/, '')
          const res = await timedFetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model || 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
          })
          if (res.ok) return NextResponse.json({ success: true, message: 'OpenAI connection successful' })
          return NextResponse.json({ success: false, message: `HTTP ${res.status}: Check credentials` })
        }

        if (llmProvider === 'anthropic') {
          const raw = endpoint || 'https://api.anthropic.com/v1'
          try { validateUrl(raw, false) } catch (e: unknown) {
            return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Invalid URL' }, { status: 400 })
          }
          const base = raw.replace(/\/$/, '')
          const res = await timedFetch(`${base}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey || '',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: model || 'claude-haiku-4-5-20251001',
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 1,
            }),
          })
          if (res.ok) return NextResponse.json({ success: true, message: 'Anthropic connection successful' })
          return NextResponse.json({ success: false, message: `HTTP ${res.status}: Check credentials` })
        }

        return NextResponse.json({ success: false, message: 'Unknown LLM provider' })
      }

      default:
        return NextResponse.json({ success: false, message: 'Unknown provider' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error
      ? (err.name === 'AbortError' ? 'Timeout after 5s' : err.message)
      : 'Unknown error'
    return NextResponse.json({ success: false, message: msg })
  }
}
