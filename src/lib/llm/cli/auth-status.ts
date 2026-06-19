/**
 * Detects whether the provider CLIs are installed and signed in, and triggers
 * their login flows — the data behind the Settings "Sign in" rows.
 *
 * Install + login checks need an exit code, so they go through the one-shot
 * `run_process_blocking` command (not the streaming `spawn_process`). Login is
 * interactive and browser-based, so {@link startCliLogin} streams the login
 * process's output (which includes the URL to open) and hands back a `stop()`.
 *
 * Desktop-only. NOTE: codex exposes a clean `codex login status`; claude has no
 * such command, so its sign-in state is inferred from a small `claude -p` probe
 * (a real, if tiny, request) — best run on explicit user action, not on every
 * Settings open. Both command shapes are best-effort and flagged for
 * confirmation on the first real desktop run (see PROGRESS.md).
 *
 * @module
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@/lib/platform'
import type { CliKind } from './cli-invoke'

export type CliAuthStatus =
  | 'unavailable' // not running in the desktop app
  | 'not-installed' // CLI binary not found on PATH
  | 'signed-out' // installed but not authenticated
  | 'signed-in' // installed and authenticated
  | 'unknown' // installed, but sign-in state couldn't be determined

interface ProcOutput {
  code: number | null
  stdout: string
  stderr: string
}

const CMD: Record<CliKind, string> = { claude: 'claude', codex: 'codex' }
/** Args that start each CLI's interactive, browser-based login. */
const LOGIN_ARGS: Record<CliKind, string[]> = {
  claude: ['setup-token'],
  codex: ['login'],
}

function runBlocking(cmd: string, args: string[]): Promise<ProcOutput> {
  return invoke<ProcOutput>('run_process_blocking', { cmd, args, cwd: null })
}

/** Classify a `claude -p` probe into a sign-in status. Pure, for testability. */
export function classifyClaudeProbe(out: ProcOutput): CliAuthStatus {
  const text = `${out.stdout}\n${out.stderr}`.toLowerCase()
  if (/log ?in|authenticat|oauth|unauthorized|api key|credit balance/.test(text)) {
    return 'signed-out'
  }
  return out.code === 0 ? 'signed-in' : 'unknown'
}

/**
 * Determine whether the CLI for `kind` is installed and signed in.
 *
 * @returns one of {@link CliAuthStatus}; never throws.
 */
export async function getCliAuthStatus(kind: CliKind): Promise<CliAuthStatus> {
  if (!isTauri()) return 'unavailable'
  const cmd = CMD[kind]

  // 1. Installed?
  let version: ProcOutput
  try {
    version = await runBlocking(cmd, ['--version'])
  } catch {
    return 'not-installed'
  }
  if (version.code !== 0) return 'not-installed'

  // 2. Signed in?
  if (kind === 'codex') {
    try {
      const status = await runBlocking(cmd, ['login', 'status'])
      return status.code === 0 ? 'signed-in' : 'signed-out'
    } catch {
      return 'unknown'
    }
  }
  // claude: no status command — infer from a tiny probe request.
  try {
    return classifyClaudeProbe(await runBlocking(cmd, ['-p', 'ping', '--output-format', 'json']))
  } catch {
    return 'unknown'
  }
}

export interface CliLoginSession {
  /** Terminate the login process and stop listening to its output. */
  stop: () => Promise<void>
}

/**
 * Start the CLI's interactive login, forwarding every stdout/stderr line (the
 * login URL is among them) to `onLine`. The browser is opened by the CLI itself.
 *
 * @throws In browser mode.
 */
export async function startCliLogin(
  kind: CliKind,
  onLine: (line: string) => void,
): Promise<CliLoginSession> {
  if (!isTauri()) throw new Error('CLI login is only available in the desktop app')
  const processId = await invoke<string>('spawn_process', {
    cmd: CMD[kind],
    args: LOGIN_ARGS[kind],
    cwd: null,
  })
  const unlistenOut = await listen<string>(`process://stdout/${processId}`, (e) => onLine(e.payload))
  const unlistenErr = await listen<string>(`process://stderr/${processId}`, (e) => onLine(e.payload))
  return {
    stop: async () => {
      unlistenOut()
      unlistenErr()
      await invoke('kill_process', { processId }).catch(() => {})
    },
  }
}
