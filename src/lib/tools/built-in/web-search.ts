/**
 * Built-in web-search tool (§8.2).
 *
 * @module
 */
import type { JSONSchema, ToolContext, ToolDefinition } from '@/lib/interfaces'
import { assertDomainAllowed, notWiredYet } from './guards'

/** Arguments accepted by {@link WebSearchTool}. */
export interface WebSearchInput {
  /** The search query. */
  query: string
  /** Maximum number of results to return. */
  maxResults?: number
}

/** A single web-search hit. */
export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

/** Search the web and return ranked results. */
export class WebSearchTool implements ToolDefinition<WebSearchInput, WebSearchResult[]> {
  readonly name = 'web_search'
  readonly description = 'Search the web and return a ranked list of result links and snippets.'
  readonly source = 'built-in' as const
  readonly version = '1.0.0'

  readonly inputSchema: JSONSchema<WebSearchInput> = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
      maxResults: { type: 'number', description: 'Maximum number of results (default 5).' },
    },
    required: ['query'],
  }

  async execute(input: WebSearchInput, context: ToolContext): Promise<WebSearchResult[]> {
    // A search engine is a remote host — honor the agent's domain allow-list.
    assertDomainAllowed(context.permissionScope, 'https://duckduckgo.com')
    void input
    throw notWiredYet(this.name)
  }
}
