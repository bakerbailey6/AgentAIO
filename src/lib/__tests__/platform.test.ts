import { describe, it, expect, afterEach } from 'vitest'
import { isTauri } from '@/lib/platform'

type TauriWindow = Record<string, unknown>

describe('isTauri', () => {
  afterEach(() => {
    delete (window as TauriWindow).__TAURI_INTERNALS__
  })

  it('returns true when Tauri internals are injected', () => {
    ;(window as TauriWindow).__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })

  it('returns false in a plain browser (no Tauri internals)', () => {
    delete (window as TauriWindow).__TAURI_INTERNALS__
    expect(isTauri()).toBe(false)
  })
})
