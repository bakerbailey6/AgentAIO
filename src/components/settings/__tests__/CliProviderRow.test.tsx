import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CliProviderRow from '../CliProviderRow'

const { mockStatus, mockLogin } = vi.hoisted(() => ({ mockStatus: vi.fn(), mockLogin: vi.fn() }))
vi.mock('@/lib/llm/cli/auth-status', () => ({
  getCliAuthStatus: mockStatus,
  startCliLogin: mockLogin,
}))

beforeEach(() => vi.clearAllMocks())

describe('CliProviderRow', () => {
  it('shows the signed-in state without a Login button', async () => {
    mockStatus.mockResolvedValue('signed-in')
    render(<CliProviderRow displayName="Claude (subscription)" kind="claude" />)
    await waitFor(() => expect(screen.getByText('Signed in')).toBeDefined())
    expect(screen.queryByText('Login')).toBeNull()
    expect(screen.getByText('Re-check')).toBeDefined()
  })

  it('offers Login when signed out and streams the login output', async () => {
    mockStatus.mockResolvedValue('signed-out')
    const stop = vi.fn(async () => {})
    mockLogin.mockImplementation(async (_kind: string, onLine: (l: string) => void) => {
      onLine('Open https://auth.example/device')
      return { stop }
    })
    render(<CliProviderRow displayName="Codex (subscription)" kind="codex" />)
    await waitFor(() => expect(screen.getByText('Signed out')).toBeDefined())

    fireEvent.click(screen.getByText('Login'))

    await waitFor(() => expect(screen.getByText(/Complete sign-in/)).toBeDefined())
    expect(screen.getByText(/Open https:\/\/auth\.example\/device/)).toBeDefined()
    expect(mockLogin).toHaveBeenCalledWith('codex', expect.any(Function))
  })

  it('degrades to a read-only Desktop only row in browser mode', async () => {
    mockStatus.mockResolvedValue('unavailable')
    render(<CliProviderRow displayName="Claude (subscription)" kind="claude" />)
    await waitFor(() => expect(screen.getByText('Desktop only')).toBeDefined())
    expect(screen.queryByText('Re-check')).toBeNull()
    expect(screen.queryByText('Login')).toBeNull()
  })
})
