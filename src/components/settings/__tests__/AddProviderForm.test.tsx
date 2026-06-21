import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AddProviderForm from '../AddProviderForm'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'set_secret') return undefined
    if (cmd === 'get_secret') return null
    if (cmd === 'delete_secret') return undefined
  }),
}))
vi.mock('@/lib/llm/providers/index', () => ({
  PROVIDER_REGISTRY: new Map([
    ['anthropic', { testConnection: vi.fn(async () => ({ success: true, latencyMs: 42 })) }],
    ['openai', { testConnection: vi.fn(async () => ({ success: true, latencyMs: 10 })) }],
    ['ollama', { testConnection: vi.fn(async () => ({ success: false, error: 'Not running' })) }],
  ]),
}))

describe('AddProviderForm', () => {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('renders provider options', () => {
    render(<AddProviderForm onSaved={onSaved} onCancel={onCancel} />)
    expect(screen.getByRole('combobox')).toBeDefined()
  })

  it('calls setSecret on save', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    render(<AddProviderForm onSaved={onSaved} onCancel={onCancel} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'anthropic' } })
    fireEvent.change(screen.getByPlaceholderText(/api key/i), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('set_secret', expect.objectContaining({ key: 'anthropic-key' })))
  })

  it('disables Save until a non-empty API key is entered', () => {
    render(<AddProviderForm onSaved={onSaved} onCancel={onCancel} />)
    const save = screen.getByText('Save') as HTMLButtonElement
    // Anthropic (default) with no key -> Save disabled.
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(/api key/i), { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText(/api key/i), { target: { value: 'sk-real' } })
    expect(save.disabled).toBe(false)
  })

  it('allows Save for Ollama without an API key', () => {
    render(<AddProviderForm onSaved={onSaved} onCancel={onCancel} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ollama' } })
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows connection result on test', async () => {
    render(<AddProviderForm onSaved={onSaved} onCancel={onCancel} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'anthropic' } })
    fireEvent.click(screen.getByText('Test'))
    await waitFor(() => expect(screen.getByText(/connected/i)).toBeDefined())
  })
})
