import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PermissionScope, ToolContext } from '@/lib/interfaces'

const { invoke, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@/lib/platform', () => ({ isTauri }))

import { ShellTool } from '@/lib/tools/built-in/shell'

function makeContext(shellEnabled: boolean): ToolContext {
  const permissionScope: PermissionScope = {
    allowedPaths: [],
    allowedDomains: [],
    shellEnabled,
  }
  return { agentId: 'a', sessionId: 's', permissionScope }
}

describe('ShellTool', () => {
  beforeEach(() => {
    invoke.mockReset()
    isTauri.mockReset()
    isTauri.mockReturnValue(true)
  })

  it('rejects when the scope disables shell access and does not invoke', async () => {
    const tool = new ShellTool()
    await expect(tool.execute({ command: 'echo' }, makeContext(false))).rejects.toThrow(
      /permission scope/i,
    )
    expect(invoke).not.toHaveBeenCalled()
  })

  it('invokes run_process_blocking and maps the result when shell is enabled', async () => {
    invoke.mockResolvedValue({ code: 0, stdout: 'out', stderr: 'err' })
    const tool = new ShellTool()

    const result = await tool.execute({ command: 'echo', args: ['hi'] }, makeContext(true))

    expect(invoke).toHaveBeenCalledWith('run_process_blocking', {
      cmd: 'echo',
      args: ['hi'],
      cwd: undefined,
    })
    expect(result).toEqual({ stdout: 'out', stderr: 'err', exitCode: 0 })
  })

  it('maps a null exit code to -1', async () => {
    invoke.mockResolvedValue({ code: null, stdout: '', stderr: '' })
    const tool = new ShellTool()

    const result = await tool.execute({ command: 'sleep', args: ['1'] }, makeContext(true))

    expect(result.exitCode).toBe(-1)
  })

  it('defaults args to an empty array when omitted', async () => {
    invoke.mockResolvedValue({ code: 0, stdout: '', stderr: '' })
    const tool = new ShellTool()

    await tool.execute({ command: 'pwd' }, makeContext(true))

    expect(invoke).toHaveBeenCalledWith('run_process_blocking', {
      cmd: 'pwd',
      args: [],
      cwd: undefined,
    })
  })

  it('rejects in web mode (isTauri false) and does not invoke', async () => {
    isTauri.mockReturnValue(false)
    const tool = new ShellTool()

    await expect(tool.execute({ command: 'echo' }, makeContext(true))).rejects.toThrow(
      /requires the desktop app/i,
    )
    expect(invoke).not.toHaveBeenCalled()
  })
})
