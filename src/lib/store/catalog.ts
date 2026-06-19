/**
 * Static catalog of MCP servers offered in the store.
 *
 * Phase 1 ships a small built-in list rather than a live registry; the store UI
 * renders {@link MCP_CATALOG} and `useInstalledMcps().install` turns a chosen
 * entry into a configured `mcps` row by using `commandTemplate` as the command.
 *
 * @module
 */

/** A single installable MCP server in the store catalog. */
export interface CatalogMcpEntry {
  name: string
  description: string
  version: string
  transport: 'stdio' | 'sse'
  /** Command used to launch the server (for `stdio` transports). */
  commandTemplate: string
}

/** The built-in set of MCP servers the store offers for install. */
export const MCP_CATALOG: CatalogMcpEntry[] = [
  {
    name: '@modelcontextprotocol/server-filesystem',
    description: 'Read and write files on the local filesystem',
    version: '0.6.2',
    transport: 'stdio',
    commandTemplate: 'npx @modelcontextprotocol/server-filesystem',
  },
  {
    name: '@modelcontextprotocol/server-github',
    description: 'Interact with GitHub repositories, issues, and pull requests',
    version: '0.5.0',
    transport: 'stdio',
    commandTemplate: 'npx @modelcontextprotocol/server-github',
  },
  {
    name: '@modelcontextprotocol/server-brave-search',
    description: 'Web search via the Brave Search API',
    version: '0.5.0',
    transport: 'stdio',
    commandTemplate: 'npx @modelcontextprotocol/server-brave-search',
  },
  {
    name: '@modelcontextprotocol/server-memory',
    description: 'Persistent key-value memory store for agents',
    version: '0.5.0',
    transport: 'stdio',
    commandTemplate: 'npx @modelcontextprotocol/server-memory',
  },
]
