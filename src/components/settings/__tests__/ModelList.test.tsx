import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ModelList from '../ModelList'

const mockDb = { execute: vi.fn(async () => ({ rowsAffected: 1 })), select: vi.fn(async (): Promise<Record<string, unknown>[]> => []) }
vi.mock('@tauri-apps/plugin-sql', () => ({ default: { load: vi.fn(async () => mockDb) } }))

describe('ModelList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows empty state when no models', async () => {
    render(<ModelList />)
    await waitFor(() => expect(screen.getByText(/no models/i)).toBeDefined())
  })

  it('shows model rows when models exist', async () => {
    mockDb.select.mockResolvedValueOnce([{
      id: 'm1', provider: 'anthropic', model_name: 'claude-sonnet-4-6',
      display_name: 'Claude Sonnet', api_key_ref: 'anthropic-key',
      base_url: null, created_at: 0,
    }])
    render(<ModelList />)
    await waitFor(() => expect(screen.getByText('Claude Sonnet')).toBeDefined())
  })
})
