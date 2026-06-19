import { describe, it, expect } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'
import { BrowserTool } from '../browser'

function makeContext(allowedDomains: string[]): ToolContext {
  return {
    agentId: 'a',
    sessionId: 's',
    permissionScope: {
      allowedPaths: [],
      allowedDomains,
      shellEnabled: false,
    },
  }
}

describe('BrowserTool', () => {
  const tool = new BrowserTool()
  const input = { url: 'https://example.com' }

  it('rejects with the domain-guard error when the URL host is not allowed', async () => {
    const ctx = makeContext([])
    await expect(tool.execute(input, ctx)).rejects.toThrow(
      /is not in this agent.s allowed domains/,
    )
  })

  it('rejects with the not-available message when the domain is allowed', async () => {
    const ctx = makeContext(['example.com'])
    await expect(tool.execute(input, ctx)).rejects.toThrow(
      /browser is not available yet/,
    )
  })
})
