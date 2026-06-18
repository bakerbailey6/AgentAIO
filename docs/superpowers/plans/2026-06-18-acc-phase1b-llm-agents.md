# Agent Command Center — Phase 1B: LLM Layer, MCP Registry & Agent Runtimes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the LLM router (Anthropic, OpenAI, Ollama + any OpenAI-compatible), the MCP registry, and three agent runtimes: LLM agent, Claude Code, and OpenAI Codex.

**Architecture:** Every LLM provider implements `LLMProvider<TModel>` from Phase 1A. The `LLMRouter` resolves a stored model ID to a Vercel AI SDK `LanguageModelV1` adapter. Every agent runtime implements `AgentProvider<TConfig, TEvent>`. Coding agents (Claude Code, Codex) are managed as child processes by the Tauri Rust sidecar. MCP servers each run in their own isolated process via the Anthropic MCP SDK.

**Prerequisites:** Phase 1A complete — all interfaces, storage, keychain, and event bus in place.

**Tech Stack:** Vercel AI SDK ≥ 4 · `@ai-sdk/anthropic` · `@ai-sdk/openai` · `@ai-sdk/ollama` · `@modelcontextprotocol/sdk` · `@anthropic-ai/claude-code` · Tauri process commands from Phase 1A

## Global Constraints

- All provider credentials fetched from keychain via `getSecret()` — never hardcoded
- Adding a new LLM provider = implement `LLMProvider<TModel>`, add to `PROVIDER_REGISTRY` — zero other changes
- Adding a new agent type = implement `AgentProvider`, add to `AGENT_REGISTRY` — zero other changes
- MCP servers run in isolated processes — one crash must not affect others
- `"strict": true` TypeScript throughout
- Vitest for all unit tests

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/llm/providers/anthropic.ts` | `AnthropicProvider` implements `LLMProvider` |
| `src/lib/llm/providers/openai.ts` | `OpenAIProvider` implements `LLMProvider` (also covers OpenAI-compatible) |
| `src/lib/llm/providers/ollama.ts` | `OllamaProvider` implements `LLMProvider` |
| `src/lib/llm/providers/index.ts` | `PROVIDER_REGISTRY: Map<string, LLMProvider>` |
| `src/lib/llm/router.ts` | `LLMRouter` — resolves model DB row → `LanguageModelV1` |
| `src/lib/mcp/registry.ts` | `MCPRegistry` — connect/disconnect/list/invoke MCP servers |
| `src/lib/agents/llm-agent.ts` | `LLMAgentProvider` implements `AgentProvider` |
| `src/lib/agents/claude-code-agent.ts` | `ClaudeCodeAgentProvider` implements `AgentProvider` |
| `src/lib/agents/codex-agent.ts` | `CodexAgentProvider` implements `AgentProvider` |
| `src/lib/agents/registry.ts` | `AGENT_REGISTRY: Map<string, AgentProvider>` |
| `src-tauri/src/commands/process.rs` | `spawn_process`, `kill_process`, `send_stdin`, `read_stdout` |
| `src/lib/__tests__/llm-router.test.ts` | LLM router unit tests |
| `src/lib/__tests__/mcp-registry.test.ts` | MCP registry unit tests |
| `src/lib/__tests__/llm-agent.test.ts` | LLM agent unit tests |

---

## Task 6: Tauri Process Management Commands

**Files:**
- Create: `src-tauri/src/commands/process.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `spawn_process(cmd, args, cwd)` → `processId: string`, `kill_process(id)`, `send_stdin(id, data)`, Tauri events `process://stdout/<id>` and `process://stderr/<id>`

- [ ] **Step 1: Write process.rs**

```rust
// src-tauri/src/commands/process.rs
use std::collections::HashMap;
use std::io::Write;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Emitter};
use uuid::Uuid;

type ProcessMap = Arc<Mutex<HashMap<String, Child>>>;

fn get_processes(app: &AppHandle) -> ProcessMap {
    app.state::<ProcessMap>().inner().clone()
}

#[command]
pub fn spawn_process(
    app: AppHandle,
    cmd: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let mut builder = Command::new(&cmd);
    builder.args(&args).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd {
        builder.current_dir(dir);
    }
    let child = builder.spawn().map_err(|e| e.to_string())?;
    get_processes(&app).lock().unwrap().insert(id.clone(), child);
    Ok(id)
}

#[command]
pub fn kill_process(app: AppHandle, process_id: String) -> Result<(), String> {
    let mut map = get_processes(&app).lock().unwrap();
    if let Some(mut child) = map.remove(&process_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub fn send_stdin(app: AppHandle, process_id: String, data: String) -> Result<(), String> {
    let mut map = get_processes(&app).lock().unwrap();
    if let Some(child) = map.get_mut(&process_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

Add to `Cargo.toml`: `uuid = { version = "1", features = ["v4"] }`

- [ ] **Step 2: Register process commands in lib.rs**

```rust
// src-tauri/src/lib.rs
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};
use commands::process::{kill_process, send_stdin, spawn_process};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(Arc::new(Mutex::new(HashMap::<String, std::process::Child>::new())))
        .invoke_handler(tauri::generate_handler![
            set_secret, get_secret, delete_secret,
            spawn_process, kill_process, send_stdin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify Rust compiles**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: Compiles with no errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/process.rs src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: Tauri process management commands for coding agents"
```

---

## Task 7: LLM Providers & Router

**Files:**
- Create: `src/lib/llm/providers/anthropic.ts`
- Create: `src/lib/llm/providers/openai.ts`
- Create: `src/lib/llm/providers/ollama.ts`
- Create: `src/lib/llm/providers/index.ts`
- Create: `src/lib/llm/router.ts`
- Test: `src/lib/__tests__/llm-router.test.ts`

**Interfaces:**
- Consumes: `LLMProvider`, `BaseModel`, `Credentials`, `ConnectionResult` from `@/lib/interfaces`
- Produces: `LLMRouter.getAdapter(modelId: string): Promise<LanguageModelV1>`, `PROVIDER_REGISTRY`

- [ ] **Step 1: Write failing router test**

Create `src/lib/__tests__/llm-router.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => (modelId: string) => ({ modelId, provider: 'anthropic' })),
}))
vi.mock('@/lib/keychain', () => ({
  getSecret: vi.fn(async () => 'test-api-key'),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({
    select: vi.fn(async () => [{
      id: 'model-1', provider: 'anthropic', model_name: 'claude-sonnet-4-6',
      display_name: 'Claude Sonnet 4.6', api_key_ref: 'anthropic-key', base_url: null,
    }]),
  })),
}))

import { LLMRouter } from '@/lib/llm/router'

describe('LLMRouter', () => {
  it('resolves anthropic model to an adapter', async () => {
    const router = new LLMRouter()
    const adapter = await router.getAdapter('model-1')
    expect(adapter).toBeDefined()
  })

  it('throws for unknown model id', async () => {
    const router = new LLMRouter()
    await expect(router.getAdapter('nonexistent')).rejects.toThrow('Model not found')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/llm-router.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Write AnthropicProvider**

```typescript
// src/lib/llm/providers/anthropic.ts
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModelV1 } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface AnthropicModel extends BaseModel {
  provider: 'anthropic'
}

export class AnthropicProvider implements LLMProvider<AnthropicModel> {
  readonly providerId = 'anthropic'
  readonly displayName = 'Anthropic'

  async listModels(_credentials: Credentials): Promise<AnthropicModel[]> {
    return [
      { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
      { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
      { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', contextWindow: 200000, supportsTools: true, supportsStreaming: true, provider: 'anthropic' },
    ]
  }

  createAdapter(model: AnthropicModel, credentials: Credentials): LanguageModelV1 {
    const anthropic = createAnthropic({ apiKey: credentials.apiKey })
    return anthropic(model.id) as LanguageModelV1
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      await this.listModels(credentials)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 4: Write OpenAIProvider**

```typescript
// src/lib/llm/providers/openai.ts
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface OpenAIModel extends BaseModel {
  provider: 'openai'
}

export class OpenAIProvider implements LLMProvider<OpenAIModel> {
  readonly providerId = 'openai'
  readonly displayName = 'OpenAI'

  async listModels(_credentials: Credentials): Promise<OpenAIModel[]> {
    return [
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, supportsTools: true, supportsStreaming: true, provider: 'openai' },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, supportsTools: true, supportsStreaming: true, provider: 'openai' },
      { id: 'o3', displayName: 'o3', contextWindow: 200000, supportsTools: true, supportsStreaming: false, provider: 'openai' },
    ]
  }

  createAdapter(model: OpenAIModel, credentials: Credentials): LanguageModelV1 {
    const openai = createOpenAI({
      apiKey: credentials.apiKey,
      ...(credentials.baseUrl ? { baseURL: credentials.baseUrl } : {}),
    })
    return openai(model.id) as LanguageModelV1
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      await this.listModels(credentials)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 5: Write OllamaProvider**

```typescript
// src/lib/llm/providers/ollama.ts
import { createOllama } from '@ai-sdk/ollama'
import type { LanguageModelV1 } from 'ai'
import type { LLMProvider, BaseModel, Credentials, ConnectionResult } from '@/lib/interfaces'

export interface OllamaModel extends BaseModel {
  provider: 'ollama'
}

export class OllamaProvider implements LLMProvider<OllamaModel> {
  readonly providerId = 'ollama'
  readonly displayName = 'Ollama (Local)'

  async listModels(credentials: Credentials): Promise<OllamaModel[]> {
    const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
    try {
      const res = await fetch(`${baseUrl}/api/tags`)
      const data = await res.json() as { models: Array<{ name: string }> }
      return data.models.map((m) => ({
        id: m.name,
        displayName: m.name,
        contextWindow: 8192,
        supportsTools: false,
        supportsStreaming: true,
        provider: 'ollama' as const,
      }))
    } catch {
      return []
    }
  }

  createAdapter(model: OllamaModel, credentials: Credentials): LanguageModelV1 {
    const ollama = createOllama({ baseURL: credentials.baseUrl ?? 'http://localhost:11434/api' })
    return ollama(model.id) as LanguageModelV1
  }

  async testConnection(credentials: Credentials): Promise<ConnectionResult> {
    const start = Date.now()
    try {
      const baseUrl = credentials.baseUrl ?? 'http://localhost:11434'
      await fetch(`${baseUrl}/api/tags`)
      return { success: true, latencyMs: Date.now() - start }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
```

- [ ] **Step 6: Write provider registry and router**

```typescript
// src/lib/llm/providers/index.ts
import type { LLMProvider } from '@/lib/interfaces'
import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import { OllamaProvider } from './ollama'

export const PROVIDER_REGISTRY = new Map<string, LLMProvider>([
  ['anthropic', new AnthropicProvider()],
  ['openai', new OpenAIProvider()],
  ['ollama', new OllamaProvider()],
])

export function registerProvider(provider: LLMProvider): void {
  PROVIDER_REGISTRY.set(provider.providerId, provider)
}
```

```typescript
// src/lib/llm/router.ts
import type { LanguageModelV1 } from 'ai'
import { initDb } from '@/lib/storage'
import { ModelRepository } from '@/lib/storage/repositories/models'
import { getSecret } from '@/lib/keychain'
import { PROVIDER_REGISTRY } from './providers'

export class LLMRouter {
  async getAdapter(modelId: string): Promise<LanguageModelV1> {
    const db = await initDb()
    const repo = new ModelRepository(db)
    const model = await repo.findById(modelId)
    if (!model) throw new Error(`Model not found: ${modelId}`)

    const provider = PROVIDER_REGISTRY.get(model.provider)
    if (!provider) throw new Error(`Provider not registered: ${model.provider}`)

    const apiKey = model.apiKeyRef ? await getSecret(model.apiKeyRef) ?? undefined : undefined
    const credentials = { apiKey, baseUrl: model.baseUrl ?? undefined }

    return provider.createAdapter(
      { id: model.modelName, displayName: model.displayName, contextWindow: 200000, supportsTools: true, supportsStreaming: true },
      credentials,
    )
  }
}
```

- [ ] **Step 7: Run tests — expect pass**

```bash
npx vitest run src/lib/__tests__/llm-router.test.ts
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/llm/ src/lib/__tests__/llm-router.test.ts
git commit -m "feat: LLM router with Anthropic, OpenAI, Ollama providers"
```

---

## Task 8: MCP Registry

**Files:**
- Create: `src/lib/mcp/registry.ts`
- Test: `src/lib/__tests__/mcp-registry.test.ts`

**Interfaces:**
- Consumes: `@modelcontextprotocol/sdk`, `McpRepository` from storage
- Produces: `MCPRegistry` with `connect(id)`, `disconnect(id)`, `listConnected()`, `callTool(serverId, toolName, args)`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/mcp-registry.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    listTools: vi.fn(async () => ({ tools: [{ name: 'test-tool' }] })),
    callTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'result' }] })),
  })),
}))
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@/lib/storage', () => ({
  initDb: vi.fn(async () => ({
    select: vi.fn(async () => [{
      id: 'mcp-1', name: 'filesystem', transport: 'stdio',
      command_or_url: 'npx @modelcontextprotocol/server-filesystem /tmp',
      env_vars_ref: '[]', enabled: 1,
    }]),
  })),
}))

import { MCPRegistry } from '@/lib/mcp/registry'

describe('MCPRegistry', () => {
  it('connects a stdio MCP server', async () => {
    const registry = new MCPRegistry()
    await registry.connect('mcp-1')
    expect(registry.listConnected()).toContain('mcp-1')
  })

  it('disconnects a connected server', async () => {
    const registry = new MCPRegistry()
    await registry.connect('mcp-1')
    await registry.disconnect('mcp-1')
    expect(registry.listConnected()).not.toContain('mcp-1')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/mcp-registry.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MCPRegistry**

```typescript
// src/lib/mcp/registry.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { initDb } from '@/lib/storage'
import { McpRepository } from '@/lib/storage/repositories/mcps'

interface ConnectedServer {
  client: Client
  serverId: string
}

export class MCPRegistry {
  private connections = new Map<string, ConnectedServer>()

  async connect(serverId: string): Promise<void> {
    if (this.connections.has(serverId)) return

    const db = await initDb()
    const repo = new McpRepository(db)
    const server = await repo.findById(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    const client = new Client({ name: 'agent-command-center', version: '1.0.0' })

    let transport
    if (server.transport === 'stdio') {
      const [cmd, ...args] = server.commandOrUrl.split(' ')
      transport = new StdioClientTransport({ command: cmd, args })
    } else {
      transport = new SSEClientTransport(new URL(server.commandOrUrl))
    }

    await client.connect(transport)
    this.connections.set(serverId, { client, serverId })
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (!conn) return
    await conn.client.close()
    this.connections.delete(serverId)
  }

  listConnected(): string[] {
    return Array.from(this.connections.keys())
  }

  async callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    return conn.client.callTool({ name: toolName, arguments: args as Record<string, unknown> })
  }

  async listTools(serverId: string): Promise<Array<{ name: string; description?: string }>> {
    const conn = this.connections.get(serverId)
    if (!conn) throw new Error(`MCP server not connected: ${serverId}`)
    const result = await conn.client.listTools()
    return result.tools
  }
}

let _registry: MCPRegistry | null = null
export function getMCPRegistry(): MCPRegistry {
  if (!_registry) _registry = new MCPRegistry()
  return _registry
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/__tests__/mcp-registry.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mcp/ src/lib/__tests__/mcp-registry.test.ts
git commit -m "feat: MCP registry with stdio and SSE transport support"
```

---

## Task 9: LLM Agent Runtime

**Files:**
- Create: `src/lib/agents/llm-agent.ts`
- Create: `src/lib/agents/registry.ts`
- Test: `src/lib/__tests__/llm-agent.test.ts`

**Interfaces:**
- Consumes: `AgentProvider`, `AgentEvent`, `AgentSession` from interfaces; `LLMRouter`; `AuditLogRepository`
- Produces: `LLMAgentProvider` registered in `AGENT_REGISTRY` under type `'llm'`

- [ ] **Step 1: Write failing test**

Create `src/lib/__tests__/llm-agent.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/llm/router', () => ({
  LLMRouter: vi.fn().mockImplementation(() => ({
    getAdapter: vi.fn(async () => ({
      doStream: vi.fn(async function* () {
        yield { type: 'text-delta', textDelta: 'Hello' }
        yield { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } }
      }),
    })),
  })),
}))
vi.mock('@/lib/storage', () => ({ initDb: vi.fn(async () => ({})) }))

import { LLMAgentProvider } from '@/lib/agents/llm-agent'

describe('LLMAgentProvider', () => {
  it('implements AgentProvider interface', () => {
    const provider = new LLMAgentProvider()
    expect(provider.type).toBe('llm')
    expect(typeof provider.run).toBe('function')
    expect(typeof provider.stop).toBe('function')
    expect(typeof provider.approve).toBe('function')
    expect(typeof provider.deny).toBe('function')
    expect(typeof provider.getCapabilities).toBe('function')
  })

  it('getCapabilities returns expected values', () => {
    const provider = new LLMAgentProvider()
    const caps = provider.getCapabilities()
    expect(caps.supportsTools).toBe(true)
    expect(caps.supportsStreaming).toBe(true)
    expect(caps.requiresProjectDirectory).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/llm-agent.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement LLMAgentProvider**

```typescript
// src/lib/agents/llm-agent.ts
import { streamText } from 'ai'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'
import { LLMRouter } from '@/lib/llm/router'

export interface LLMAgentConfig {
  modelId: string
  systemPrompt: string
  toolIds: string[]
  mcpIds: string[]
}

const router = new LLMRouter()
const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>()

export class LLMAgentProvider implements AgentProvider<LLMAgentConfig, AgentEvent> {
  readonly type = 'llm'
  readonly displayName = 'LLM Agent'
  readonly icon = '🤖'

  async configure(_config: LLMAgentConfig): Promise<void> {}

  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    const model = await router.getAdapter(session.agentId)

    yield {
      type: 'status-change',
      agentId: session.agentId,
      timestamp: Date.now(),
      payload: { status: 'running' },
    }

    const result = streamText({ model, prompt: input })

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield {
          type: 'text-delta',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: { delta: chunk.textDelta },
        }
      }
    }

    yield {
      type: 'status-change',
      agentId: session.agentId,
      timestamp: Date.now(),
      payload: { status: 'idle' },
    }
  }

  async stop(sessionId: string): Promise<void> {
    pendingApprovals.get(sessionId)?.resolve(false)
    pendingApprovals.delete(sessionId)
  }

  async approve(requestId: string): Promise<void> {
    pendingApprovals.get(requestId)?.resolve(true)
  }

  async deny(requestId: string): Promise<void> {
    pendingApprovals.get(requestId)?.resolve(false)
  }

  getCapabilities(): AgentCapabilities {
    return {
      supportsTools: true,
      supportsStreaming: true,
      supportsApprovalGates: true,
      requiresProjectDirectory: false,
    }
  }
}
```

- [ ] **Step 4: Write agent registry**

```typescript
// src/lib/agents/registry.ts
import type { AgentProvider } from '@/lib/interfaces'
import { LLMAgentProvider } from './llm-agent'
import { ClaudeCodeAgentProvider } from './claude-code-agent'
import { CodexAgentProvider } from './codex-agent'

export const AGENT_REGISTRY = new Map<string, AgentProvider>([
  ['llm', new LLMAgentProvider()],
  ['claude-code', new ClaudeCodeAgentProvider()],
  ['codex', new CodexAgentProvider()],
])

export function registerAgent(provider: AgentProvider): void {
  AGENT_REGISTRY.set(provider.type, provider)
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx vitest run src/lib/__tests__/llm-agent.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agents/llm-agent.ts src/lib/agents/registry.ts src/lib/__tests__/llm-agent.test.ts
git commit -m "feat: LLM agent runtime and agent registry"
```

---

## Task 10: Claude Code & Codex Agent Runtimes

**Files:**
- Create: `src/lib/agents/claude-code-agent.ts`
- Create: `src/lib/agents/codex-agent.ts`

**Interfaces:**
- Consumes: `AgentProvider`, `AgentEvent`, `AgentSession` from interfaces; `spawn_process`, `kill_process`, `send_stdin` Tauri commands
- Produces: `ClaudeCodeAgentProvider` (type `'claude-code'`), `CodexAgentProvider` (type `'codex'`) — both in `AGENT_REGISTRY`

- [ ] **Step 1: Write ClaudeCodeAgentProvider**

```typescript
// src/lib/agents/claude-code-agent.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'

export interface ClaudeCodeConfig {
  projectDirectory: string
  allowedPaths: string[]
}

export class ClaudeCodeAgentProvider implements AgentProvider<ClaudeCodeConfig, AgentEvent> {
  readonly type = 'claude-code'
  readonly displayName = 'Claude Code'
  readonly icon = '🧑‍💻'

  private processes = new Map<string, string>() // sessionId → processId

  async configure(_config: ClaudeCodeConfig): Promise<void> {}

  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'running' } }

    const processId = await invoke<string>('spawn_process', {
      cmd: 'claude',
      args: ['--print', '--output-format', 'stream-json', input],
      cwd: session.projectDirectory,
    })
    this.processes.set(session.id, processId)

    // Stream stdout lines as agent events via a channel
    const eventQueue: AgentEvent[] = []
    let done = false

    const unlisten = await listen<string>(`process://stdout/${processId}`, (event) => {
      try {
        const line = JSON.parse(event.payload)
        eventQueue.push({
          type: line.type === 'assistant' ? 'text-delta' : 'tool-call',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: line,
        })
        if (line.type === 'result') done = true
      } catch {
        // non-JSON line, skip
      }
    })

    while (!done || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!
      } else {
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    unlisten()
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'idle' } }
  }

  async stop(sessionId: string): Promise<void> {
    const processId = this.processes.get(sessionId)
    if (processId) {
      await invoke('kill_process', { processId })
      this.processes.delete(sessionId)
    }
  }

  async approve(requestId: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'y\n' })
  }

  async deny(requestId: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'n\n' })
  }

  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
```

- [ ] **Step 2: Write CodexAgentProvider**

```typescript
// src/lib/agents/codex-agent.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentProvider, AgentEvent, AgentSession, AgentCapabilities } from '@/lib/interfaces'

export interface CodexConfig {
  projectDirectory: string
}

export class CodexAgentProvider implements AgentProvider<CodexConfig, AgentEvent> {
  readonly type = 'codex'
  readonly displayName = 'OpenAI Codex'
  readonly icon = '⚡'

  private processes = new Map<string, string>()

  async configure(_config: CodexConfig): Promise<void> {}

  async *run(session: AgentSession, input: string): AsyncIterable<AgentEvent> {
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'running' } }

    const processId = await invoke<string>('spawn_process', {
      cmd: 'codex',
      args: ['--approval-mode', 'suggest', '--quiet', input],
      cwd: session.projectDirectory,
    })
    this.processes.set(session.id, processId)

    const eventQueue: AgentEvent[] = []
    let done = false

    const unlisten = await listen<string>(`process://stdout/${processId}`, (event) => {
      try {
        const line = JSON.parse(event.payload)
        eventQueue.push({
          type: line.type === 'message' ? 'text-delta' : 'tool-call',
          agentId: session.agentId,
          timestamp: Date.now(),
          payload: line,
        })
        if (line.type === 'done') done = true
      } catch { /* skip non-JSON */ }
    })

    while (!done || eventQueue.length > 0) {
      if (eventQueue.length > 0) yield eventQueue.shift()!
      else await new Promise((r) => setTimeout(r, 50))
    }

    unlisten()
    yield { type: 'status-change', agentId: session.agentId, timestamp: Date.now(), payload: { status: 'idle' } }
  }

  async stop(sessionId: string): Promise<void> {
    const processId = this.processes.get(sessionId)
    if (processId) {
      await invoke('kill_process', { processId })
      this.processes.delete(sessionId)
    }
  }

  async approve(requestId: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'yes\n' })
  }

  async deny(requestId: string): Promise<void> {
    const processId = this.processes.get(requestId)
    if (processId) await invoke('send_stdin', { processId, data: 'no\n' })
  }

  getCapabilities(): AgentCapabilities {
    return { supportsTools: true, supportsStreaming: true, supportsApprovalGates: true, requiresProjectDirectory: true }
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/agents/claude-code-agent.ts src/lib/agents/codex-agent.ts
git commit -m "feat: Claude Code and Codex agent runtimes"
```

---

## Verification

- [ ] `npx vitest run` — all tests pass
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` — compiles clean
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run tauri dev` — app launches

Phase 1B complete. Proceed to **Phase 1C: Spatial Canvas UI + Approval Gates + Store Panel**.
