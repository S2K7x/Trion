'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3
type TestState = { status: 'idle' | 'loading' | 'ok' | 'err'; message: string }

const idle: TestState = { status: 'idle', message: '' }

function useTest(provider: string) {
  const [state, setState] = useState<TestState>(idle)

  const run = useCallback(async (body: Record<string, string>) => {
    setState({ status: 'loading', message: '' })
    try {
      const res = await fetch(`/api/config/test/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setState({ status: data.success ? 'ok' : 'err', message: data.message ?? '' })
    } catch (e: unknown) {
      setState({ status: 'err', message: e instanceof Error ? e.message : 'Network error' })
    }
  }, [provider])

  return { state, run, reset: () => setState(idle) }
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block font-mono text-[11px] font-medium tracking-wide uppercase mb-1.5" style={{ color: 'var(--muted)' }}>
      {children}
      {required && <span style={{ color: 'var(--red)' }} className="ml-1">*</span>}
    </label>
  )
}

function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
}: {
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-[8px] font-mono text-[13px] outline-none transition-colors"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-2)',
        color: 'var(--text)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
    />
  )
}

function TestButton({
  state,
  onRun,
  disabled,
}: {
  state: TestState
  onRun: () => void
  disabled?: boolean
}) {
  const { status, message } = state
  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        onClick={onRun}
        disabled={disabled || status === 'loading'}
        className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors disabled:opacity-40"
        style={{
          background: 'var(--surface-2)',
          color: 'var(--muted)',
          border: '1px solid var(--border)',
        }}
      >
        {status === 'loading' && (
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        Test Connection
      </button>
      {status === 'ok' && (
        <span className="font-mono text-[11px] flex items-center gap-1" style={{ color: 'var(--green)' }}>
          <span>✓</span> {message}
        </span>
      )}
      {status === 'err' && (
        <span className="font-mono text-[11px] flex items-center gap-1" style={{ color: 'var(--red)' }}>
          <span>✗</span> {message}
        </span>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 px-3 py-2 rounded-[8px] w-full text-left transition-colors"
      style={{
        background: checked ? 'var(--green-dim)' : 'var(--surface-2)',
        border: `1px solid ${checked ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
      }}
    >
      <div
        className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
        style={{ background: checked ? 'var(--green)' : 'var(--dim)' }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
      <span className="font-mono text-[12px]" style={{ color: checked ? 'var(--green)' : 'var(--muted)' }}>
        {label}
      </span>
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] p-6 flex flex-col gap-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>
}

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Database' },
    { n: 2, label: 'Integrations' },
    { n: 3, label: 'LLM' },
  ] as const

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map(({ n, label }, i) => {
        const done = current > n
        const active = current === n
        return (
          <div key={n} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px] font-bold transition-colors"
                style={{
                  background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--surface)',
                  color: done || active ? '#0d1117' : 'var(--muted)',
                  border: done || active ? 'none' : '1px solid var(--border-2)',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span
                className="font-mono text-[11px] font-medium hidden sm:block"
                style={{ color: active ? 'var(--text)' : done ? 'var(--green)' : 'var(--muted)' }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-12 h-px mx-3"
                style={{ background: current > n ? 'var(--green)' : 'var(--border-2)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main wizard ─────────────────────────────────────────────────────── */

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Step 1 — Supabase
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const supabaseTest = useTest('supabase')

  // Step 2 — Notifications + Threat Intel
  const [slackUrl, setSlackUrl] = useState('')
  const [vtKey, setVtKey] = useState('')
  const [abuseKey, setAbuseKey] = useState('')
  const [mbEnabled, setMbEnabled] = useState(false)
  const slackTest = useTest('slack')
  const vtTest = useTest('virustotal')
  const abuseTest = useTest('abuseipdb')
  const mbTest = useTest('malwarebazaar')

  // Step 3 — LLM
  const [llmProvider, setLlmProvider] = useState<'ollama' | 'openai' | 'anthropic'>('ollama')
  const [llmEndpoint, setLlmEndpoint] = useState('http://localhost:11434')
  const [llmModel, setLlmModel] = useState('')
  const [llmKey, setLlmKey] = useState('')
  const llmTest = useTest('llm')

  const LLM_DEFAULTS: Record<string, string> = {
    ollama: 'http://localhost:11434',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
  }

  const canProceed1 = supabaseTest.state.status === 'ok'
  const canProceed2 = slackTest.state.status === 'ok'

  async function handleComplete(skipLlm = false) {
    setSubmitting(true)
    setSubmitError('')

    const config: Record<string, string> = {
      supabase_url: supabaseUrl,
      supabase_service_key: supabaseKey,
      slack_webhook_url: slackUrl,
      malwarebazaar_enabled: mbEnabled ? 'true' : 'false',
    }
    if (vtKey) config['virustotal_api_key'] = vtKey
    if (abuseKey) config['abuseipdb_api_key'] = abuseKey
    if (!skipLlm && llmProvider) {
      config['llm_provider'] = llmProvider
      config['llm_endpoint'] = llmEndpoint
      if (llmModel) config['llm_model'] = llmModel
      if (llmKey) config['llm_api_key'] = llmKey
    }
    config['setup_complete'] = 'true'

    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? 'Failed to save configuration')
        setSubmitting(false)
        return
      }
      router.push('/')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-start justify-center px-4 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-lg fade-up-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-[6px] flex items-center justify-center font-display font-bold text-[13px]"
              style={{ background: 'var(--accent)', color: '#0d1117' }}
            >
              T
            </div>
            <span className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>
              Trion
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--text)' }}>
            Welcome to Trion
          </h1>
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            Complete these steps to configure your SOC dashboard.
          </p>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Database ── */}
        {step === 1 && (
          <Card>
            <div>
              <h2 className="font-display font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>
                Database
              </h2>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                Connect Trion to your Supabase project.
              </p>
            </div>

            <Field>
              <Label required>Supabase URL</Label>
              <Input
                value={supabaseUrl}
                onChange={(v) => { setSupabaseUrl(v); supabaseTest.reset() }}
                placeholder="https://xxxx.supabase.co"
              />
            </Field>

            <Field>
              <Label required>Service Role Key</Label>
              <Input
                type="password"
                value={supabaseKey}
                onChange={(v) => { setSupabaseKey(v); supabaseTest.reset() }}
                placeholder="eyJ..."
              />
              <p className="text-[11px] mt-1" style={{ color: 'var(--dim)' }}>
                Supabase → Settings → API → service_role key
              </p>
            </Field>

            <TestButton
              state={supabaseTest.state}
              onRun={() => supabaseTest.run({ url: supabaseUrl, key: supabaseKey })}
              disabled={!supabaseUrl || !supabaseKey}
            />

            <button
              onClick={() => setStep(2)}
              disabled={!canProceed1}
              className="mt-2 w-full py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-opacity disabled:opacity-30"
              style={{ background: 'var(--accent)', color: '#0d1117' }}
            >
              Next Step →
            </button>
          </Card>
        )}

        {/* ── Step 2: Integrations ── */}
        {step === 2 && (
          <Card>
            <div>
              <h2 className="font-display font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>
                Notifications &amp; Threat Intel
              </h2>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                Slack is required. Threat intel sources are optional.
              </p>
            </div>

            {/* Slack */}
            <div
              className="rounded-[8px] p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <p className="font-mono text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                Slack
              </p>
              <Field>
                <Label required>Webhook URL</Label>
                <Input
                  value={slackUrl}
                  onChange={(v) => { setSlackUrl(v); slackTest.reset() }}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </Field>
              <TestButton
                state={slackTest.state}
                onRun={() => slackTest.run({ url: slackUrl })}
                disabled={!slackUrl}
              />
            </div>

            {/* VirusTotal */}
            <div
              className="rounded-[8px] p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <p className="font-mono text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
                VirusTotal <span className="normal-case">(optional)</span>
              </p>
              <Field>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={vtKey}
                  onChange={(v) => { setVtKey(v); vtTest.reset() }}
                  placeholder="64-char API key"
                />
              </Field>
              {vtKey && (
                <TestButton
                  state={vtTest.state}
                  onRun={() => vtTest.run({ key: vtKey })}
                />
              )}
            </div>

            {/* AbuseIPDB */}
            <div
              className="rounded-[8px] p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <p className="font-mono text-[10px] font-medium tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
                AbuseIPDB <span className="normal-case">(optional)</span>
              </p>
              <Field>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={abuseKey}
                  onChange={(v) => { setAbuseKey(v); abuseTest.reset() }}
                  placeholder="API key"
                />
              </Field>
              {abuseKey && (
                <TestButton
                  state={abuseTest.state}
                  onRun={() => abuseTest.run({ key: abuseKey })}
                />
              )}
            </div>

            {/* MalwareBazaar */}
            <div
              className="rounded-[8px] p-4 flex flex-col gap-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <p className="font-mono text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: 'var(--muted)' }}>
                MalwareBazaar <span className="normal-case">(no key required)</span>
              </p>
              <Toggle
                checked={mbEnabled}
                onChange={setMbEnabled}
                label={mbEnabled ? 'Enabled' : 'Disabled'}
              />
              {mbEnabled && (
                <TestButton
                  state={mbTest.state}
                  onRun={() => mbTest.run({})}
                />
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceed2}
                className="flex-[2] py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-opacity disabled:opacity-30"
                style={{ background: 'var(--accent)', color: '#0d1117' }}
              >
                Next Step →
              </button>
            </div>
          </Card>
        )}

        {/* ── Step 3: LLM ── */}
        {step === 3 && (
          <Card>
            <div>
              <h2 className="font-display font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>
                LLM Integration
              </h2>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                Optional — power AI-assisted triage and explanations.
              </p>
            </div>

            {/* Provider selector */}
            <Field>
              <Label>Provider</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['ollama', 'openai', 'anthropic'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setLlmProvider(p)
                      setLlmEndpoint(LLM_DEFAULTS[p])
                      llmTest.reset()
                    }}
                    className="py-2 rounded-[8px] font-mono text-[11px] font-medium capitalize transition-colors"
                    style={
                      llmProvider === p
                        ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                        : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            <Field>
              <Label>Endpoint URL</Label>
              <Input
                value={llmEndpoint}
                onChange={(v) => { setLlmEndpoint(v); llmTest.reset() }}
                placeholder={LLM_DEFAULTS[llmProvider]}
              />
            </Field>

            <Field>
              <Label>Model Name</Label>
              <Input
                value={llmModel}
                onChange={(v) => { setLlmModel(v); llmTest.reset() }}
                placeholder={
                  llmProvider === 'ollama'
                    ? 'llama3.2'
                    : llmProvider === 'openai'
                    ? 'gpt-4o-mini'
                    : 'claude-haiku-4-5-20251001'
                }
              />
            </Field>

            {llmProvider !== 'ollama' && (
              <Field>
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(v) => { setLlmKey(v); llmTest.reset() }}
                  placeholder="API key"
                />
              </Field>
            )}

            <TestButton
              state={llmTest.state}
              onRun={() =>
                llmTest.run({
                  provider: llmProvider,
                  endpoint: llmEndpoint,
                  apiKey: llmKey,
                  model: llmModel,
                })
              }
              disabled={!llmEndpoint}
            />

            {submitError && (
              <p className="font-mono text-[11px] px-3 py-2 rounded-[6px]" style={{ color: 'var(--red)', background: 'var(--red-dim)' }}>
                {submitError}
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setStep(2)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                ← Back
              </button>
              <button
                onClick={() => handleComplete(true)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-opacity disabled:opacity-40"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                Skip
              </button>
              <button
                onClick={() => handleComplete(false)}
                disabled={submitting}
                className="flex-[2] py-2.5 rounded-[8px] font-display font-bold text-[13px] transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--green)', color: '#0d1117' }}
              >
                {submitting && (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                Complete Setup
              </button>
            </div>
          </Card>
        )}

        <p className="text-center font-mono text-[10px] mt-6" style={{ color: 'var(--dim)' }}>
          All sensitive values are encrypted with AES-256-GCM before storage.
        </p>
      </div>
    </div>
  )
}
