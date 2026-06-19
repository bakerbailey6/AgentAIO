import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { BaseModel } from '@/lib/interfaces'
import AddModelDialog from '../AddModelDialog'

const {
  mockAnthropicListModels,
  mockOllamaListModels,
  mockClaudeCliListModels,
  mockCreate,
  mockGetSecret,
  mockInitDb,
} = vi.hoisted(() => ({
  mockAnthropicListModels: vi.fn(),
  mockOllamaListModels: vi.fn(),
  mockClaudeCliListModels: vi.fn(),
  mockCreate: vi.fn(),
  mockGetSecret: vi.fn(),
  mockInitDb: vi.fn(),
}))

vi.mock('@/lib/llm/providers/index', () => ({
  PROVIDER_REGISTRY: new Map([
    ['anthropic', { listModels: mockAnthropicListModels }],
    ['ollama', { listModels: mockOllamaListModels }],
    ['claude-cli', { authType: 'cli', displayName: 'Claude (subscription)', listModels: mockClaudeCliListModels }],
  ]),
}))
vi.mock('@/lib/keychain', () => ({ getSecret: mockGetSecret }))
vi.mock('@/lib/storage/db', () => ({ initDb: mockInitDb }))
vi.mock('@/lib/storage/repositories/models', () => {
  class ModelRepository {
    create = mockCreate
  }
  return { ModelRepository }
})

const anthropicModel: BaseModel = {
  id: 'claude-sonnet-4-6',
  displayName: 'Claude Sonnet 4.6',
  contextWindow: 200_000,
  supportsTools: true,
  supportsStreaming: true,
}

describe('AddModelDialog', () => {
  const onAdded = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSecret.mockResolvedValue('sk-test')
    mockInitDb.mockResolvedValue({})
    mockCreate.mockResolvedValue('model-id')
    mockAnthropicListModels.mockResolvedValue([anthropicModel])
    mockOllamaListModels.mockResolvedValue([])
    mockClaudeCliListModels.mockResolvedValue([])
  })

  it('renders the provider step with a button per registered provider', () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)
    expect(screen.getByText('Select Provider')).toBeDefined()
    expect(screen.getByText('Anthropic')).toBeDefined()
    expect(screen.getByText('Ollama (local)')).toBeDefined()
  })

  it('transitions to step 2 and fetches the model list for the chosen provider', async () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Anthropic'))

    expect(screen.getByText('Select Model')).toBeDefined()
    await waitFor(() => expect(screen.getByText('Claude Sonnet 4.6')).toBeDefined())
    expect(mockAnthropicListModels).toHaveBeenCalledWith({ apiKey: 'sk-test' })
  })

  it('creates the model with the right fields when a model is selected', async () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Anthropic'))
    await waitFor(() => expect(screen.getByText('Claude Sonnet 4.6')).toBeDefined())

    fireEvent.click(screen.getByText('Claude Sonnet 4.6'))

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        provider: 'anthropic',
        modelName: 'claude-sonnet-4-6',
        displayName: 'Claude Sonnet 4.6',
        apiKeyRef: 'anthropic-key',
        baseUrl: null,
      }),
    )
    expect(onAdded).toHaveBeenCalledTimes(1)
  })

  it('lists and adds a CLI subscription model without a key (apiKeyRef null)', async () => {
    mockClaudeCliListModels.mockResolvedValue([
      { id: 'opus', displayName: 'Claude Opus (subscription)', contextWindow: 200_000, supportsTools: true, supportsStreaming: true },
    ])
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Claude (subscription)'))
    await waitFor(() => expect(screen.getByText('Claude Opus (subscription)')).toBeDefined())
    expect(mockClaudeCliListModels).toHaveBeenCalledWith({})
    expect(mockGetSecret).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Claude Opus (subscription)'))
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        provider: 'claude-cli',
        modelName: 'opus',
        displayName: 'Claude Opus (subscription)',
        apiKeyRef: null,
        baseUrl: null,
      }),
    )
  })

  it('shows the empty message when a provider returns no models', async () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Ollama (local)'))

    await waitFor(() => expect(screen.getByText('No models available.')).toBeDefined())
  })

  it('shows the Ollama "not running" error when the model fetch rejects', async () => {
    mockOllamaListModels.mockRejectedValue(new Error('ECONNREFUSED'))
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)

    fireEvent.click(screen.getByText('Ollama (local)'))

    await waitFor(() =>
      expect(screen.getByText('Ollama not running at localhost:11434')).toBeDefined(),
    )
  })

  it('returns to the provider step via Back', async () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Anthropic'))
    expect(screen.getByText('Select Model')).toBeDefined()

    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByText('Select Provider')).toBeDefined()
  })

  it('calls onCancel when the close button is clicked', () => {
    render(<AddModelDialog onAdded={onAdded} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('✕'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
