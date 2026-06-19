import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platform', () => ({ isTauri: vi.fn(() => true) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@/lib/platform'
import { getCliAuthStatus, classifyClaudeProbe, startCliLogin } from '../auth-status'

const mockInvoke = vi.mocked(invoke)
const mockListen = vi.mocked(listen)
const mockIsTauri = vi.mocked(isTauri)

function out(code: number | null, stdout = '', stderr = '') {
  return { code, stdout, stderr }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsTauri.mockReturnValue(true)
})

describe('getCliAuthStatus', () => {
  it('returns unavailable in browser mode', async () => {
    mockIsTauri.mockReturnValue(false)
    expect(await getCliAuthStatus('claude')).toBe('unavailable')
  })

  it('returns not-installed when --version cannot be spawned', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('not found'))
    expect(await getCliAuthStatus('codex')).toBe('not-installed')
  })

  it('returns not-installed when --version exits non-zero', async () => {
    mockInvoke.mockResolvedValueOnce(out(127))
    expect(await getCliAuthStatus('codex')).toBe('not-installed')
  })

  it('reports codex signed-in when login status exits 0', async () => {
    mockInvoke
      .mockResolvedValueOnce(out(0, 'codex 1.0')) // --version
      .mockResolvedValueOnce(out(0, 'Logged in')) // login status
    expect(await getCliAuthStatus('codex')).toBe('signed-in')
  })

  it('reports codex signed-out when login status exits non-zero', async () => {
    mockInvoke
      .mockResolvedValueOnce(out(0, 'codex 1.0')) // --version
      .mockResolvedValueOnce(out(1, '', 'not logged in')) // login status
    expect(await getCliAuthStatus('codex')).toBe('signed-out')
  })

  it('reports claude signed-in from a clean probe', async () => {
    mockInvoke
      .mockResolvedValueOnce(out(0, 'claude 1.0')) // --version
      .mockResolvedValueOnce(out(0, '{"result":"pong"}')) // probe
    expect(await getCliAuthStatus('claude')).toBe('signed-in')
  })

  it('reports claude signed-out when the probe mentions auth', async () => {
    mockInvoke
      .mockResolvedValueOnce(out(0, 'claude 1.0')) // --version
      .mockResolvedValueOnce(out(1, '', 'Please run /login to authenticate')) // probe
    expect(await getCliAuthStatus('claude')).toBe('signed-out')
  })
})

describe('classifyClaudeProbe', () => {
  it('flags auth keywords as signed-out', () => {
    expect(classifyClaudeProbe(out(1, '', 'OAuth token expired'))).toBe('signed-out')
  })
  it('treats a clean zero-exit as signed-in', () => {
    expect(classifyClaudeProbe(out(0, 'hello'))).toBe('signed-in')
  })
  it('is unknown on a non-zero exit without auth keywords', () => {
    expect(classifyClaudeProbe(out(2, '', 'some other error'))).toBe('unknown')
  })
})

describe('startCliLogin', () => {
  it('throws in browser mode', async () => {
    mockIsTauri.mockReturnValue(false)
    await expect(startCliLogin('codex', () => {})).rejects.toThrow('desktop app')
  })

  it('forwards stdout/stderr lines and stop() kills the process', async () => {
    mockInvoke.mockResolvedValue('proc-9') // spawn_process id, then kill_process
    const handlers: Array<(e: { payload: string }) => void> = []
    mockListen.mockImplementation(async (_event, handler) => {
      handlers.push(handler as (e: { payload: string }) => void)
      return () => {}
    })

    const lines: string[] = []
    const session = await startCliLogin('codex', (l) => lines.push(l))

    // Deliver a line on the stdout listener (first registered).
    handlers[0]({ payload: 'Open https://auth.example/device' })
    expect(lines).toContain('Open https://auth.example/device')

    await session.stop()
    expect(mockInvoke).toHaveBeenCalledWith('kill_process', { processId: 'proc-9' })
  })
})
