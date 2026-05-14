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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-block w-2 h-2 rounded-full bg-[#ef4444] mr-2 align-middle" />
          <span className="text-[#e5e5e5] text-lg font-mono tracking-wider">mini-soc</span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#555555] text-xs mb-1 font-mono uppercase tracking-widest">
                password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full bg-[#0a0a0a] border border-[#333333] text-[#e5e5e5] font-mono text-sm px-3 py-2 rounded outline-none focus:border-[#3b82f6] transition-colors"
                placeholder="········"
              />
            </div>

            {error && (
              <p className="text-[#ef4444] text-xs font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#1a1a1a] border border-[#333333] text-[#e5e5e5] font-mono text-sm px-3 py-2 rounded hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'authenticating...' : 'authenticate →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
