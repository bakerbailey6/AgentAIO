import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'

const { mocks, isTauriMock } = vi.hoisted(() => ({
  mocks: {
    listDirectory: vi.fn(),
    globFiles: vi.fn(),
    grepFiles: vi.fn(),
    readTextFile: vi.fn(),
    writeTextFile: vi.fn(),
  },
  isTauriMock: vi.fn(() => true),
}))
vi.mock('@/lib/fs', () => mocks)
vi.mock('@/lib/platform', () => ({ isTauri: isTauriMock }))

import { ListDirectoryTool } from '@/lib/tools/built-in/list-directory'
import { GlobTool } from '@/lib/tools/built-in/glob'
import { GrepTool } from '@/lib/tools/built-in/grep'
import { EditFileTool } from '@/lib/tools/built-in/edit-file'

function ctx(allowedPaths: string[]): ToolContext {
  return { agentId: 'a', sessionId: 's', permissionScope: { allowedPaths, allowedDomains: [], shellEnabled: true } }
}

describe('workspace tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriMock.mockReturnValue(true)
  })

  describe('ListDirectoryTool', () => {
    it('defaults to the workspace root and formats dirs/files', async () => {
      mocks.listDirectory.mockResolvedValue([
        { name: 'src', path: '/repo/src', is_dir: true, size: 0 },
        { name: 'a.txt', path: '/repo/a.txt', is_dir: false, size: 12 },
      ])
      const out = await new ListDirectoryTool().execute({}, ctx(['/repo']))
      expect(mocks.listDirectory).toHaveBeenCalledWith('/repo', ['/repo'])
      expect(out).toBe('src/\na.txt (12 bytes)')
    })
    it('rejects a path outside the workspace', async () => {
      await expect(new ListDirectoryTool().execute({ path: '/etc' }, ctx(['/repo']))).rejects.toThrow(/allowed paths/i)
      expect(mocks.listDirectory).not.toHaveBeenCalled()
    })
  })

  describe('GlobTool', () => {
    it('globs under the workspace root by default', async () => {
      mocks.globFiles.mockResolvedValue(['/repo/src/a.ts', '/repo/b.ts'])
      const out = await new GlobTool().execute({ pattern: '**/*.ts' }, ctx(['/repo']))
      expect(mocks.globFiles).toHaveBeenCalledWith('/repo', '**/*.ts', ['/repo'])
      expect(out).toContain('/repo/src/a.ts')
    })
    it('reports no matches cleanly', async () => {
      mocks.globFiles.mockResolvedValue([])
      expect(await new GlobTool().execute({ pattern: '*.zzz' }, ctx(['/repo']))).toMatch(/no files match/i)
    })
  })

  describe('GrepTool', () => {
    it('formats matches as path:line: text', async () => {
      mocks.grepFiles.mockResolvedValue([{ path: '/repo/x.ts', line: 3, text: 'const needle = 1' }])
      const out = await new GrepTool().execute({ pattern: 'needle' }, ctx(['/repo']))
      expect(mocks.grepFiles).toHaveBeenCalledWith('/repo', 'needle', ['/repo'])
      expect(out).toBe('/repo/x.ts:3: const needle = 1')
    })
  })

  describe('EditFileTool', () => {
    it('replaces a unique snippet and writes it back', async () => {
      mocks.readTextFile.mockResolvedValue('hello world')
      const out = await new EditFileTool().execute(
        { path: '/repo/f.txt', oldText: 'world', newText: 'there' }, ctx(['/repo']),
      )
      expect(mocks.writeTextFile).toHaveBeenCalledWith('/repo/f.txt', 'hello there', ['/repo'])
      expect(out).toMatch(/1 replacement/)
    })
    it('throws when the old text is missing', async () => {
      mocks.readTextFile.mockResolvedValue('hello world')
      await expect(
        new EditFileTool().execute({ path: '/repo/f.txt', oldText: 'nope', newText: 'x' }, ctx(['/repo'])),
      ).rejects.toThrow(/not found/i)
      expect(mocks.writeTextFile).not.toHaveBeenCalled()
    })
    it('refuses an ambiguous edit unless replaceAll', async () => {
      mocks.readTextFile.mockResolvedValue('a a a')
      await expect(
        new EditFileTool().execute({ path: '/repo/f.txt', oldText: 'a', newText: 'b' }, ctx(['/repo'])),
      ).rejects.toThrow(/appears 3 times/i)
      // With replaceAll it succeeds.
      const out = await new EditFileTool().execute(
        { path: '/repo/f.txt', oldText: 'a', newText: 'b', replaceAll: true }, ctx(['/repo']),
      )
      expect(mocks.writeTextFile).toHaveBeenCalledWith('/repo/f.txt', 'b b b', ['/repo'])
      expect(out).toMatch(/3 replacements/)
    })
  })
})
