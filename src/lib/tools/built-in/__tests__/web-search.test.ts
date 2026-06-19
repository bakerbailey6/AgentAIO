import { describe, it, expect } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'
import { WebSearchTool } from '../web-search'

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

describe('WebSearchTool', () => {
  const tool = new WebSearchTool()
  const input = { query: 'agent command center' }

  it('rejects with the domain-guard error when the search host is not allowed', async () => {
    const ctx = makeContext([])
    await expect(tool.execute(input, ctx)).rejects.toThrow(
      /is not in this agent.s allowed domains/,
    )
  })

  it('rejects with the not-available message when the domain is allowed', async () => {
    const ctx = makeContext(['duckduckgo.com'])
    await expect(tool.execute(input, ctx)).rejects.toThrow(
      /web_search is not available yet/,
    )
  })
})
