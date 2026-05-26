import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServerSupabase } from '@/lib/supabase-server'
import { decryptValue } from '@/lib/config-crypto'

const UNENCRYPTED_CONFIG_KEYS = new Set(['setup_complete', 'malwarebazaar_enabled'])

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('dashboard_session')?.value
  if (!token) return false
  try {
    const secret = new TextEncoder().encode(process.env.DASHBOARD_SECRET!)
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

interface LlmConfig {
  provider: string
  endpoint: string
  model: string
  api_key: string
}

async function getLlmConfig(): Promise<LlmConfig> {
  try {
    const supabase = createServerSupabase()
    const { data, error } = await supabase
      .from('trion_config')
      .select('key, value')
      .in('key', ['llm_provider', 'llm_endpoint', 'llm_model', 'llm_api_key'])

    if (error || !data) throw new Error('config fetch failed')

    const raw: Record<string, string> = {}
    for (const row of data) {
      try {
        raw[row.key] = UNENCRYPTED_CONFIG_KEYS.has(row.key)
          ? row.value
          : decryptValue(row.value)
      } catch {
        raw[row.key] = ''
      }
    }

    return {
      provider: raw['llm_provider'] || 'ollama',
      endpoint: raw['llm_endpoint'] || 'http://localhost:11434',
      model:    raw['llm_model']    || 'llama3.2',
      api_key:  raw['llm_api_key']  || '',
    }
  } catch {
    return { provider: 'ollama', endpoint: 'http://localhost:11434', model: 'llama3.2', api_key: '' }
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

async function callOllama(
  systemPrompt: string,
  messages: ChatMessage[],
  cfg: LlmConfig,
): Promise<string> {
  const base = cfg.endpoint.replace(/\/$/, '')
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
      options: { num_predict: 500 },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`)
  const data = await res.json() as { message?: { content: string }; response?: string }
  return data.message?.content ?? data.response ?? ''
}

async function callOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  cfg: LlmConfig,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.api_key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 500,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`OpenAI responded ${res.status}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  cfg: LlmConfig,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.api_key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Anthropic responded ${res.status}`)
  const data = await res.json() as { content: Array<{ text: string }> }
  return data.content?.[0]?.text ?? ''
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { messages?: ChatMessage[]; alert_id?: string }
    const { messages, alert_id } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
    }

    // Build system prompt
    let systemPrompt =
      'You are Trion, a SOC (Security Operations Center) assistant. ' +
      'Answer security questions concisely and clearly, using plain English when possible.'

    if (alert_id) {
      try {
        const supabase = createServerSupabase()
        const { data: alertData } = await supabase
          .from('alert_queue')
          .select('id, rule_id, rule_desc, rule_level, agent_name, agent_ip, username, command, iocs, status, created_at, llm_verdict')
          .eq('id', alert_id)
          .single()

        if (alertData) {
          systemPrompt =
            'You are Trion, a SOC assistant. Analyze this security alert and answer questions about it. ' +
            'Use plain English and avoid technical jargon when possible. Be concise.\n\n' +
            'Alert data:\n' + JSON.stringify(alertData, null, 2)
        }
      } catch {
        // Proceed with generic prompt if alert fetch fails
      }
    }

    const cfg = await getLlmConfig()
    let reply: string

    try {
      if (cfg.provider === 'openai') {
        reply = await callOpenAI(systemPrompt, messages, cfg)
      } else if (cfg.provider === 'anthropic') {
        reply = await callAnthropic(systemPrompt, messages, cfg)
      } else {
        reply = await callOllama(systemPrompt, messages, cfg)
      }
    } catch (err) {
      console.error('[chat] LLM call failed:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'LLM unreachable', fallback: true }, { status: 502 })
    }

    if (!reply.trim()) {
      return NextResponse.json({ error: 'Empty response from LLM', fallback: true }, { status: 502 })
    }

    return NextResponse.json({ message: reply })
  } catch (err) {
    console.error('[chat] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
