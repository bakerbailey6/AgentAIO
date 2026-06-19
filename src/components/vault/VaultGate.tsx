'use client'
/**
 * Gates the app behind the encrypted-vault unlock.
 *
 * On the desktop build it unlocks the SQLCipher DB (keychain passphrase → key →
 * migrations, via `initDb`) before rendering the app, showing a first-run /
 * unlocking overlay and a hard error with retry on failure. In web mode there
 * is no keychain/SQLite, so it renders the (degraded) shell directly — matching
 * the app's existing "swallow native errors" behavior and keeping web-mode E2E
 * working.
 */
import { useEffect, useState } from 'react'
import { initDb, vaultExists } from '@/lib/storage/db'

interface VaultGateProps {
  children: React.ReactNode
}

type Status = 'unlocking' | 'ready' | 'error'

/** True only inside the Tauri desktop runtime (keychain + SQLite available). */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function VaultGate({ children }: VaultGateProps) {
  const [status, setStatus] = useState<Status>(() => (isTauri() ? 'unlocking' : 'ready'))
  const [firstRun, setFirstRun] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    setStatus('unlocking')
    setError(null)
    ;(async () => {
      try {
        const existed = await vaultExists()
        if (!cancelled) setFirstRun(!existed)
        await initDb()
        if (!cancelled) setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (status === 'ready') return <>{children}</>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0b]"
      role="dialog"
      aria-modal="true"
      aria-label="Encrypted vault"
    >
      <div className="w-[360px] rounded-2xl border border-white/[0.08] bg-[#0d0d0f] p-6 text-center">
        {status === 'unlocking' ? (
          <>
            <div
              className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-white/[0.12] border-t-indigo-500"
              aria-hidden="true"
            />
            <h2 className="text-[14px] font-semibold text-zinc-200">
              {firstRun ? 'Setting up your encrypted vault' : 'Unlocking encrypted vault'}
            </h2>
            <p className="mt-1.5 text-[12px] text-zinc-500">
              {firstRun
                ? 'Generating a key and securing it in your OS keychain…'
                : 'Decrypting your local database…'}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-[14px] text-red-400">
              !
            </div>
            <h2 className="text-[14px] font-semibold text-zinc-200">Couldn’t unlock the vault</h2>
            <p className="mt-1.5 break-words text-[12px] text-zinc-500">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-4 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-[#09090b] hover:bg-zinc-100"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
