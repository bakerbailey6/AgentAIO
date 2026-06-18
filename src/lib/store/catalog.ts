export interface CatalogMcpEntry {
  name: string
  description: string
  version: string
  transport: 'stdio' | 'sse'
  commandTemplate: string
}

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
