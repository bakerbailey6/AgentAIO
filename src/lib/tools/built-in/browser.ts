/**
 * Built-in browser tool (§8.2).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertDomainAllowed } from './guards'

/** Arguments accepted by {@link BrowserTool}. */
export interface BrowserInput {
  /** URL to load. */
  url: string
  /** What to do once the page loads. */
  action?: 'read' | 'screenshot'
}

/** Result of a browser action. */
export interface BrowserResult {
  url: string
  /** Extracted page text (for `read`). */
  text?: string
  /** Base64-encoded PNG (for `screenshot`). */
  screenshot?: string
}

/** Load a page and extract its content or a screenshot. */
export class BrowserTool implements ToolDefinition<BrowserInput, BrowserResult> {
  readonly name = 'browser'
  readonly description = 'Open a web page and read its text or capture a screenshot.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<BrowserInput> = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to load.' },
      action: { type: 'string', description: 'Either "read" (default) or "screenshot".' },
    },
    required: ['url'],
  }

  async execute(input: BrowserInput, context: ToolContext): Promise<BrowserResult> {
    assertDomainAllowed(context.permissionScope, input.url)
    throw new Error(
      'browser is not available yet — it needs a browser automation backend configured in Settings.',
    )
  }
}
