'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  getCliAuthStatus,
  startCliLogin,
  type CliAuthStatus,
  type CliLoginSession,
} from '@/lib/llm/cli/auth-status'
import type { CliKind } from '@/lib/llm/cli/cli-invoke'

interface CliProviderRowProps {
  displayName: string
  kind: CliKind
}

const STATUS_LABEL: Record<CliAuthStatus, string> = {
  unavailable: 'Desktop only',
  'not-installed': 'Not installed',
  'signed-out': 'Signed out',
  'signed-in': 'Signed in',
  unknown: 'Status unknown',
}

const STATUS_DOT: Record<CliAuthStatus, string> = {
  unavailable: 'bg-zinc-600',
  'not-installed': 'bg-amber-500',
  'signed-out': 'bg-amber-500',
  'signed-in': 'bg-emerald-500',
  unknown: 'bg-zinc-500',
}

/**
 * A Settings row for a CLI-backed subscription provider (`claude` / `codex`).
 * Shows install/sign-in state, a Re-check button, and — when signed out — a
 * Login button that streams the CLI's browser-login output. Degrades to a
 * read-only "Desktop only" state in browser mode.
 */
export default function CliProviderRow({ displayName, kind }: CliProviderRowProps) {
  const [status, setStatus] = useState<CliAuthStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [loginLines, setLoginLines] = useState<string[]>([])
  const [session, setSession] = useState<CliLoginSession | null>(null)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      setStatus(await getCliAuthStatus(kind))
    } finally {
      setChecking(false)
    }
  }, [kind])

  useEffect(() => {
    void check()
  }, [check])

  async function handleLogin() {
    setLoginLines([])
    const s = await startCliLogin(kind, (line) => setLoginLines((prev) => [...prev, line]))
    setSession(s)
  }

  async function handleStopLogin() {
    await session?.stop()
    setSession(null)
    void check()
  }

  const canLogin = status === 'signed-out' || status === 'unknown'

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${status ? STATUS_DOT[status] : 'bg-zinc-700 animate-pulse'}`}
        />
        <span className="text-[13px] text-zinc-200 flex-1">{displayName}</span>
        <span className="text-[11px] text-zinc-500">{status ? STATUS_LABEL[status] : 'Checking…'}</span>
        {status !== 'unavailable' && (
          <button
            onClick={check}
            disabled={checking}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Re-check'}
          </button>
        )}
        {canLogin && !session && (
          <button
            onClick={handleLogin}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Login
          </button>
        )}
      </div>

      {session && (
        <div className="bg-black/30 border border-white/[0.06] rounded-lg p-2 flex flex-col gap-1">
          <p className="text-[11px] text-zinc-400">
            Complete sign-in in your browser, then click Re-check.
          </p>
          {loginLines.length > 0 && (
            <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {loginLines.join('\n')}
            </pre>
          )}
          <button
            onClick={handleStopLogin}
            className="self-start text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Done / Cancel
          </button>
        </div>
      )}
    </div>
  )
}
