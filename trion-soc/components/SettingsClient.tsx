'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type TestState = { status: 'idle' | 'loading' | 'ok' | 'err'; message: string }
type ToastState = { visible: boolean; message: string; type: 'ok' | 'err' }

const idle: TestState = { status: 'idle', message: '' }

/* ── Toast ─────────────────────────────────────────────────────────── */
function Toast({ state }: { state: ToastState }) {
  if (!state.visible) return null
  return (
    <div
      className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-[8px] font-mono text-[12px] shadow-lg transition-all"
      style={{
        background: state.type === 'ok' ? 'var(--green-dim)' : 'var(--red-dim)',
        color: state.type === 'ok' ? 'var(--green)' : 'var(--red)',
        border: `1px solid ${state.type === 'ok' ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
      }}
    >
      {state.type === 'ok' ? '✓' : '✗'} {state.message}
    </div>
  )
}

/* ── Shared primitives ─────────────────────────────────────────────── */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display font-bold text-base mb-0.5" style={{ color: 'var(--text)' }}>{title}</h2>
      {subtitle && <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-mono text-[11px] font-medium tracking-wide uppercase mb-1.5" style={{ color: 'var(--muted)' }}>
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-[8px] font-mono text-[13px] outline-none transition-colors"
      style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
    />
  )
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="w-full px-3 py-2 pr-10 rounded-[8px] font-mono text-[13px] outline-none transition-colors"
        style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] transition-colors"
        style={{ color: 'var(--dim)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--muted)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--dim)')}
      >
        {show ? 'hide' : 'show'}
      </button>
    </div>
  )
}

function TestBtn({ state, onRun, disabled }: { state: TestState; onRun: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        onClick={onRun}
        disabled={disabled || state.status === 'loading'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] font-mono text-[11px] font-medium transition-colors disabled:opacity-40"
        style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        {state.status === 'loading' && (
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        )}
        Test
      </button>
      {state.status === 'ok' && <span className="font-mono text-[11px]" style={{ color: 'var(--green)' }}>✓ {state.message}</span>}
      {state.status === 'err' && <span className="font-mono text-[11px]" style={{ color: 'var(--red)' }}>✗ {state.message}</span>}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="mt-5 px-5 py-2 rounded-[8px] font-display font-bold text-[13px] transition-opacity disabled:opacity-40 flex items-center gap-2"
      style={{ background: 'var(--accent)', color: '#0d1117' }}
    >
      {saving && (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      )}
      Save
    </button>
  )
}

/* ── Module-scope custom hooks ─────────────────────────────────────── */

type SaveKeysFn = (entries: Record<string, string>) => Promise<void>
type ShowToastFn = (message: string, type: 'ok' | 'err') => void

function useSection(
  initial: Record<string, string>,
  saveKeys: SaveKeysFn,
  showToast: ShowToastFn,
) {
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (key: string) => (v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  async function save() {
    setSaving(true)
    try {
      await saveKeys(values)
      showToast('Saved successfully', 'ok')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  return { values, set, saving, save }
}

function useTestFn(provider: string) {
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
  return { state, run }
}

/* ── Main component ────────────────────────────────────────────────── */
export default function SettingsClient({ config }: { config: Record<string, string> }) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'ok' })

  function showToast(message: string, type: 'ok' | 'err') {
    setToast({ visible: true, message, type })
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000)
  }

  async function saveKeys(entries: Record<string, string>) {
    for (const [key, value] of Object.entries(entries)) {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed to save ${key}`)
      }
    }
  }

  // ── Section: Database ──
  const db = useSection(
    { supabase_url: config['supabase_url'] ?? '', supabase_service_key: config['supabase_service_key'] ?? '' },
    saveKeys, showToast,
  )
  const dbTest = useTestFn('supabase')

  // ── Section: Notifications ──
  const notifs = useSection({ slack_webhook_url: config['slack_webhook_url'] ?? '' }, saveKeys, showToast)
  const slackTest = useTestFn('slack')

  // ── Section: Threat Intel ──
  const intel = useSection({
    virustotal_api_key: config['virustotal_api_key'] ?? '',
    abuseipdb_api_key: config['abuseipdb_api_key'] ?? '',
    malwarebazaar_enabled: config['malwarebazaar_enabled'] ?? 'false',
  }, saveKeys, showToast)
  const vtTest = useTestFn('virustotal')
  const abuseTest = useTestFn('abuseipdb')
  const mbTest = useTestFn('malwarebazaar')

  // ── Section: LLM ──
  const llm = useSection({
    llm_provider: config['llm_provider'] ?? 'ollama',
    llm_endpoint: config['llm_endpoint'] ?? 'http://localhost:11434',
    llm_model: config['llm_model'] ?? '',
    llm_api_key: config['llm_api_key'] ?? '',
  }, saveKeys, showToast)
  const llmTest = useTestFn('llm')

  // ── Danger zone ──
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleReset() {
    setResetting(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'setup_complete', value: 'false' }),
      })
      if (!res.ok) throw new Error('Failed to reset')
      router.push('/setup')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Reset failed', 'err')
      setResetting(false)
    }
  }

  const LLM_DEFAULTS: Record<string, string> = {
    ollama: 'http://localhost:11434',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6 pb-16">
      <div className="mb-2">
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>Settings</h1>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Manage integrations and configuration.</p>
      </div>

      {/* ── Database ── */}
      <Panel>
        <SectionHeader title="Database" subtitle="Supabase connection settings." />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Supabase URL</FieldLabel>
            <TextInput value={db.values.supabase_url} onChange={db.set('supabase_url')} placeholder="https://xxxx.supabase.co" />
          </div>
          <div>
            <FieldLabel>Service Role Key</FieldLabel>
            <SecretInput value={db.values.supabase_service_key} onChange={db.set('supabase_service_key')} />
          </div>
          <TestBtn
            state={dbTest.state}
            onRun={() => dbTest.run({ url: db.values.supabase_url, key: db.values.supabase_service_key })}
          />
        </div>
        <SaveBtn saving={db.saving} onClick={db.save} />
      </Panel>

      {/* ── Notifications ── */}
      <Panel>
        <SectionHeader title="Notifications" subtitle="Slack alerts for triaged events." />
        <div>
          <FieldLabel>Slack Webhook URL</FieldLabel>
          <TextInput value={notifs.values.slack_webhook_url} onChange={notifs.set('slack_webhook_url')} placeholder="https://hooks.slack.com/services/..." />
        </div>
        <TestBtn
          state={slackTest.state}
          onRun={() => slackTest.run({ url: notifs.values.slack_webhook_url })}
          disabled={!notifs.values.slack_webhook_url}
        />
        <SaveBtn saving={notifs.saving} onClick={notifs.save} />
      </Panel>

      {/* ── Threat Intel ── */}
      <Panel>
        <SectionHeader title="Threat Intelligence" subtitle="External enrichment sources." />
        <div className="flex flex-col gap-5">
          <div>
            <FieldLabel>VirusTotal API Key</FieldLabel>
            <SecretInput value={intel.values.virustotal_api_key} onChange={intel.set('virustotal_api_key')} />
            <TestBtn
              state={vtTest.state}
              onRun={() => vtTest.run({ key: intel.values.virustotal_api_key })}
              disabled={!intel.values.virustotal_api_key}
            />
          </div>
          <div>
            <FieldLabel>AbuseIPDB API Key</FieldLabel>
            <SecretInput value={intel.values.abuseipdb_api_key} onChange={intel.set('abuseipdb_api_key')} />
            <TestBtn
              state={abuseTest.state}
              onRun={() => abuseTest.run({ key: intel.values.abuseipdb_api_key })}
              disabled={!intel.values.abuseipdb_api_key}
            />
          </div>
          <div>
            <FieldLabel>MalwareBazaar</FieldLabel>
            <button
              onClick={() => intel.set('malwarebazaar_enabled')(intel.values.malwarebazaar_enabled === 'true' ? 'false' : 'true')}
              className="flex items-center gap-3 px-3 py-2 rounded-[8px] transition-colors"
              style={{
                background: intel.values.malwarebazaar_enabled === 'true' ? 'var(--green-dim)' : 'var(--bg)',
                border: `1px solid ${intel.values.malwarebazaar_enabled === 'true' ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
              }}
            >
              <div
                className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: intel.values.malwarebazaar_enabled === 'true' ? 'var(--green)' : 'var(--dim)' }}
              >
                <div
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: intel.values.malwarebazaar_enabled === 'true' ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </div>
              <span className="font-mono text-[12px]" style={{ color: intel.values.malwarebazaar_enabled === 'true' ? 'var(--green)' : 'var(--muted)' }}>
                {intel.values.malwarebazaar_enabled === 'true' ? 'Enabled' : 'Disabled'}
              </span>
            </button>
            {intel.values.malwarebazaar_enabled === 'true' && (
              <TestBtn state={mbTest.state} onRun={() => mbTest.run({})} />
            )}
          </div>
        </div>
        <SaveBtn saving={intel.saving} onClick={intel.save} />
      </Panel>

      {/* ── LLM ── */}
      <Panel>
        <SectionHeader title="LLM Integration" subtitle="AI-assisted triage and analysis." />
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Provider</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {(['ollama', 'openai', 'anthropic'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    llm.set('llm_provider')(p)
                    if (!llm.values.llm_endpoint || Object.values(LLM_DEFAULTS).includes(llm.values.llm_endpoint)) {
                      llm.set('llm_endpoint')(LLM_DEFAULTS[p])
                    }
                  }}
                  className="py-2 rounded-[8px] font-mono text-[11px] font-medium capitalize transition-colors"
                  style={
                    llm.values.llm_provider === p
                      ? { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                      : { background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Endpoint URL</FieldLabel>
            <TextInput value={llm.values.llm_endpoint} onChange={llm.set('llm_endpoint')} />
          </div>
          <div>
            <FieldLabel>Model Name</FieldLabel>
            <TextInput value={llm.values.llm_model} onChange={llm.set('llm_model')} placeholder="e.g. llama3.2, gpt-4o-mini" />
          </div>
          {llm.values.llm_provider !== 'ollama' && (
            <div>
              <FieldLabel>API Key</FieldLabel>
              <SecretInput value={llm.values.llm_api_key} onChange={llm.set('llm_api_key')} />
            </div>
          )}
          <TestBtn
            state={llmTest.state}
            onRun={() =>
              llmTest.run({
                provider: llm.values.llm_provider,
                endpoint: llm.values.llm_endpoint,
                apiKey: llm.values.llm_api_key,
                model: llm.values.llm_model,
              })
            }
          />
        </div>
        <SaveBtn saving={llm.saving} onClick={llm.save} />
      </Panel>

      {/* ── Danger Zone ── */}
      <div
        className="rounded-[12px] p-6"
        style={{ background: 'var(--surface)', border: '1px solid rgba(248,81,73,0.25)' }}
      >
        <h2 className="font-display font-bold text-base mb-1" style={{ color: 'var(--red)' }}>
          Danger Zone
        </h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--muted)' }}>
          Resetting setup will lock the dashboard until the wizard is completed again.
        </p>

        {showConfirm ? (
          <div
            className="rounded-[8px] p-4 flex flex-col gap-3"
            style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,81,73,0.3)' }}
          >
            <p className="font-mono text-[12px]" style={{ color: 'var(--red)' }}>
              This will lock the dashboard until setup is completed again. Continue?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-[8px] font-display font-bold text-[12px]"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2 rounded-[8px] font-display font-bold text-[12px] transition-opacity disabled:opacity-40"
                style={{ background: 'var(--red)', color: '#fff' }}
              >
                {resetting ? 'Resetting…' : 'Yes, Reset Setup'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-[8px] font-display font-bold text-[13px] transition-colors"
            style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}
          >
            Reset Setup
          </button>
        )}
      </div>

      <Toast state={toast} />
    </div>
  )
}
