'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Invalid password')
        setPassword('')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block w-2 h-2 rounded-full bg-trion-red mr-2 align-middle" />
          <span className="font-mono text-[13px] tracking-[0.06em]" style={{ color: 'var(--text)' }}>
            Trion · SOC
          </span>
        </div>

        <div
          className="rounded-[12px] p-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block font-mono text-[10px] font-medium tracking-[0.08em] uppercase mb-1.5"
                style={{ color: 'var(--muted)' }}
              >
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full font-mono text-[13px] px-3 py-2 rounded outline-none transition-colors"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                placeholder="········"
              />
            </div>

            {error && (
              <p className="font-mono text-[11px]" style={{ color: 'var(--red)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full font-mono text-[12px] px-3 py-2 rounded border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:border-trion-accent hover:text-trion-accent"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border-2)',
                color: 'var(--muted)',
              }}
            >
              {loading ? 'authenticating...' : 'authenticate →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
