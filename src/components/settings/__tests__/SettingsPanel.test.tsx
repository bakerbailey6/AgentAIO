import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPanel from '../SettingsPanel'

const { mockGetSecret, mockDeleteSecret } = vi.hoisted(() => ({
  mockGetSecret: vi.fn(),
  mockDeleteSecret: vi.fn(),
}))

vi.mock('@/lib/keychain', () => ({
  getSecret: mockGetSecret,
  deleteSecret: mockDeleteSecret,
}))
vi.mock('@/lib/llm/providers/index', () => ({
  PROVIDER_REGISTRY: new Map([
    ['anthropic', {}],
    ['openai', {}],
    ['ollama', {}],
  ]),
}))

// Child panels pull Tauri (sql / keychain) — stub them so this test stays about
// SettingsPanel's own wiring.
vi.mock('../ModelList', () => ({ default: () => <div data-testid="model-list" /> }))
vi.mock('../AddModelDialog', () => ({
  default: () => <div data-testid="add-model-dialog" />,
}))
vi.mock('../AddProviderForm', () => ({
  default: () => <div data-testid="add-provider-form" />,
}))

describe('SettingsPanel', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSecret.mockResolvedValue('sk-test')
    mockDeleteSecret.mockResolvedValue(undefined)
  })

  it('marks providers with a stored key as configured', async () => {
    render(<SettingsPanel onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Anthropic')).toBeDefined())
    expect(screen.getByText('OpenAI')).toBeDefined()
    expect(screen.getAllByText('Remove').length).toBe(3)
  })

  it('shows the empty state when no provider has a key', async () => {
    mockGetSecret.mockResolvedValue(null)
    render(<SettingsPanel onClose={onClose} />)
    await waitFor(() =>
      expect(screen.getByText('No providers configured yet.')).toBeDefined(),
    )
    expect(screen.queryByText('Remove')).toBeNull()
  })

  it('removes a provider by deleting its key', async () => {
    render(<SettingsPanel onClose={onClose} />)
    await waitFor(() => expect(screen.getAllByText('Remove').length).toBe(3))

    fireEvent.click(screen.getAllByText('Remove')[0])

    await waitFor(() =>
      expect(mockDeleteSecret).toHaveBeenCalledWith('anthropic-key'),
    )
  })

  it('reveals the add-provider form', async () => {
    render(<SettingsPanel onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Add Provider')).toBeDefined())

    fireEvent.click(screen.getByText('Add Provider'))

    expect(screen.getByTestId('add-provider-form')).toBeDefined()
  })

  it('renders the model list and add-model dialog in the Models section', async () => {
    render(<SettingsPanel onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('Anthropic')).toBeDefined())

    fireEvent.click(screen.getByLabelText('Models'))
    expect(screen.getByTestId('model-list')).toBeDefined()

    fireEvent.click(screen.getByText('Add Model'))
    expect(screen.getByTestId('add-model-dialog')).toBeDefined()
  })

  it('calls onClose when the close button is clicked', async () => {
    render(<SettingsPanel onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close settings'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
