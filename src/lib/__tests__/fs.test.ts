import { describe, it, expect, vi, beforeEach } from 'vitest'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

import { readTextFile, writeTextFile } from '@/lib/fs'

describe('fs bridge', () => {
  beforeEach(() => vi.clearAllMocks())

  it('readTextFile invokes fs_read_text with path + allowedPaths and returns the text', async () => {
    invokeMock.mockResolvedValue('file contents')
    const out = await readTextFile('/root/a.txt', ['/root'])
    expect(invokeMock).toHaveBeenCalledWith('fs_read_text', {
      path: '/root/a.txt',
      allowedPaths: ['/root'],
    })
    expect(out).toBe('file contents')
  })

  it('writeTextFile invokes fs_write_text with path, content, and allowedPaths', async () => {
    invokeMock.mockResolvedValue(undefined)
    await writeTextFile('/root/b.txt', 'hello', ['/root'])
    expect(invokeMock).toHaveBeenCalledWith('fs_write_text', {
      path: '/root/b.txt',
      content: 'hello',
      allowedPaths: ['/root'],
    })
  })

  it('propagates a rejecting invoke (e.g. native path-guard rejection)', async () => {
    invokeMock.mockRejectedValue(new Error('Path "/etc/passwd" is outside this agent\'s allowed paths.'))
    await expect(readTextFile('/etc/passwd', ['/root'])).rejects.toThrow(/outside this agent/i)
  })
})
