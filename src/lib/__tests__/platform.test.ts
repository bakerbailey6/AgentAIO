import { describe, it, expect, afterEach } from 'vitest'
import { isTauri } from '@/lib/platform'

const w = window as unknown as Record<string, unknown>

describe('isTauri', () => {
  afterEach(() => {
    delete w.__TAURI_INTERNALS__
  })

  it('returns true when Tauri internals are injected', () => {
    w.__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
  })

  it('returns false in a plain browser (no Tauri internals)', () => {
    delete w.__TAURI_INTERNALS__
    expect(isTauri()).toBe(false)
  })
})
