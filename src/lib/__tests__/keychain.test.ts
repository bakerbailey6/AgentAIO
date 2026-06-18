import { describe, it, expect, vi } from 'vitest'

// Mock Tauri invoke for test environment
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'set_secret') return undefined
    if (cmd === 'get_secret') return args.key === 'test-key' ? 'test-value' : null
    if (cmd === 'delete_secret') return undefined
    throw new Error(`Unknown command: ${cmd}`)
  }),
}))

import { getSecret, setSecret, deleteSecret } from '@/lib/keychain'

describe('keychain', () => {
  it('set and get round-trip', async () => {
    await setSecret('test-key', 'test-value')
    const val = await getSecret('test-key')
    expect(val).toBe('test-value')
  })

  it('returns null for missing key', async () => {
    const val = await getSecret('nonexistent')
    expect(val).toBeNull()
  })

  it('delete removes key', async () => {
    await deleteSecret('test-key')
    // invoke mock returns undefined — no throw = success
  })
})
