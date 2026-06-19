import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// VaultGate drives the unlock via the storage layer; mock it at the boundary.
const { initDbMock, vaultExistsMock } = vi.hoisted(() => ({
  initDbMock: vi.fn(),
  vaultExistsMock: vi.fn(),
}))
vi.mock('@/lib/storage/db', () => ({ initDb: initDbMock, vaultExists: vaultExistsMock }))

import { VaultGate } from '@/components/vault/VaultGate'

// The gate only attempts an unlock inside the Tauri runtime, detected via
// window.__TAURI_INTERNALS__.
function enterTauri() {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
}
function exitTauri() {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
}

describe('VaultGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    exitTauri()
  })
  afterEach(() => exitTauri())

  it('renders children immediately in web mode without unlocking', () => {
    render(
      <VaultGate>
        <div>APP CONTENT</div>
      </VaultGate>,
    )
    expect(screen.getByText('APP CONTENT')).toBeInTheDocument()
    expect(initDbMock).not.toHaveBeenCalled()
    expect(vaultExistsMock).not.toHaveBeenCalled()
  })

  it('unlocks then renders children on the desktop build', async () => {
    enterTauri()
    vaultExistsMock.mockResolvedValue(true)
    initDbMock.mockResolvedValue({})
    render(
      <VaultGate>
        <div>APP CONTENT</div>
      </VaultGate>,
    )
    // Overlay shows first; children are gated until the unlock resolves.
    expect(screen.getByText('Unlocking encrypted vault')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('APP CONTENT')).toBeInTheDocument())
    expect(initDbMock).toHaveBeenCalledTimes(1)
  })

  it('shows first-run copy when the vault does not yet exist', async () => {
    enterTauri()
    vaultExistsMock.mockResolvedValue(false)
    // Keep the unlock pending so the first-run copy stays on screen.
    initDbMock.mockReturnValue(new Promise(() => {}))
    render(
      <VaultGate>
        <div>APP</div>
      </VaultGate>,
    )
    await waitFor(() =>
      expect(screen.getByText('Setting up your encrypted vault')).toBeInTheDocument(),
    )
    expect(screen.queryByText('APP')).not.toBeInTheDocument()
  })

  it('hard-blocks with an error + retry on unlock failure, then recovers', async () => {
    enterTauri()
    vaultExistsMock.mockResolvedValue(true)
    initDbMock
      .mockRejectedValueOnce(new Error('keychain locked'))
      .mockResolvedValueOnce({})
    render(
      <VaultGate>
        <div>APP CONTENT</div>
      </VaultGate>,
    )
    await waitFor(() => expect(screen.getByText('keychain locked')).toBeInTheDocument())
    expect(screen.queryByText('APP CONTENT')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('APP CONTENT')).toBeInTheDocument())
    expect(initDbMock).toHaveBeenCalledTimes(2)
  })
})
