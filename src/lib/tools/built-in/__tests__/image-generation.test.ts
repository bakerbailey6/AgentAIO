import { describe, it, expect } from 'vitest'
import type { ToolContext } from '@/lib/interfaces'
import { ImageGenerationTool } from '../image-generation'

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

describe('ImageGenerationTool', () => {
  const tool = new ImageGenerationTool()
  const input = { prompt: 'a red cube' }

  it('rejects with the not-available message (no domain dependency)', async () => {
    const ctx = makeContext([])
    await expect(tool.execute(input, ctx)).rejects.toThrow(
      /image_generation is not available yet/,
    )
  })
})
