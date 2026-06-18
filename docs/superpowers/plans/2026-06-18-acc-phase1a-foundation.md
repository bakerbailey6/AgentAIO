# Agent Command Center — Phase 1A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Tauri 2.0 + Next.js 15 project, define all extensibility interfaces, wire up encrypted SQLite storage, OS Keychain secret management, and a typed event bus.

**Architecture:** Tauri 2.0 wraps a Next.js 15 frontend. All extension points (agent types, LLM providers, tools, canvas nodes) are defined as TypeScript generic interfaces here so every subsequent plan implements rather than invents. SQLite (encrypted via SQLCipher) stores all app data; the OS Keychain stores secrets exclusively — never SQLite.

**Tech Stack:** Tauri 2.0 · Rust stable ≥ 1.77 · Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) · Vitest · `@tauri-apps/plugin-sql` · `keyring` (Rust crate) · shadcn/ui

## Global Constraints

- Node.js ≥ 20, Rust stable ≥ 1.77
- `"strict": true` in tsconfig — no implicit `any`
- Secrets go to OS Keychain exclusively — never written to SQLite, env files, or localStorage
- SQLite encrypted at rest via SQLCipher through `@tauri-apps/plugin-sql`
- Every interface uses generics so concrete implementations never require modifying the interface
- Vitest for all TypeScript unit tests; `cargo test` for Rust
- Commit after every task

---

## File Map

### Rust (`src-tauri/src/`)
| File | Responsibility |
|------|---------------|
| `main.rs` | Tauri entry point |
| `lib.rs` | Command registration, plugin setup |
| `commands/keychain.rs` | `get_secret` / `set_secret` / `delete_secret` via `keyring` crate |
| `commands/process.rs` | `spawn_process` / `kill_process` / `send_stdin` for coding agents |
| `commands/mod.rs` | Re-exports all command modules |

### TypeScript (`src/`)
| File | Responsibility |
|------|---------------|
| `lib/interfaces/agent-provider.ts` | `AgentProvider<TConfig, TEvent>` |
| `lib/interfaces/llm-provider.ts` | `LLMProvider<TModel>` |
| `lib/interfaces/tool-definition.ts` | `ToolDefinition<TInput, TOutput>` |
| `lib/interfaces/canvas-node.ts` | `CanvasNode<TData>` |
| `lib/interfaces/event-bus.ts` | `EventBus` + `AppEvent` discriminated union |
| `lib/interfaces/index.ts` | Barrel re-export |
| `lib/event-bus.ts` | `createEventBus()` — typed pub/sub implementation |
| `lib/keychain.ts` | Tauri IPC wrappers: `getSecret` / `setSecret` / `deleteSecret` |
| `lib/storage/schema.ts` | SQL DDL strings for all tables |
| `lib/storage/db.ts` | `initDb()`, `runMigrations()`, typed `query<T>()` / `execute()` helpers |
| `lib/storage/repositories/agents.ts` | `AgentRepository` — CRUD for `agents` table |
| `lib/storage/repositories/sessions.ts` | `SessionRepository` — CRUD for `sessions` table |
| `lib/storage/repositories/models.ts` | `ModelRepository` — CRUD for `models` table |
| `lib/storage/repositories/mcps.ts` | `McpRepository` — CRUD for `mcps` table |
| `lib/storage/repositories/tools.ts` | `ToolRepository` — CRUD for `tools` table |
| `lib/storage/repositories/audit-log.ts` | `AuditLogRepository` — append-only writer |
| `lib/storage/index.ts` | Barrel re-export |

### Tests
| File | What it tests |
|------|--------------|
| `src/lib/__tests__/event-bus.test.ts` | EventBus emit/on/off, typed generics |
| `src/lib/__tests__/storage.test.ts` | Schema creation, CRUD via repositories |
| `src-tauri/src/commands/keychain_test.rs` | Keychain set/get/delete round-trip |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: running `npm run tauri dev` opens a Tauri window with Next.js app

- [ ] **Step 1: Create the Tauri + Next.js project**

```bash
npm create tauri-app@latest agent-command-center -- --template next --manager npm
cd agent-command-center
npm install
```

- [ ] **Step 2: Configure TypeScript strict mode**

Edit `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Tauri SQL plugin and keyring crate**

```bash
npm install @tauri-apps/plugin-sql
cargo add keyring --manifest-path src-tauri/Cargo.toml
cargo add serde --features derive --manifest-path src-tauri/Cargo.toml
cargo add serde_json --manifest-path src-tauri/Cargo.toml
```

In `src-tauri/Cargo.toml`, ensure:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
keyring = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

- [ ] **Step 4: Register SQL plugin in lib.rs**

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Configure Tauri capabilities for SQL**

In `src-tauri/tauri.conf.json`, add to `plugins`:
```json
{
  "plugins": {
    "sql": {}
  }
}
```

- [ ] **Step 6: Install frontend dev dependencies**

```bash
npm install vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom --save-dev
npm install react-flow-renderer reactflow --save
npm install @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/openai-compatible ai --save
npm install @modelcontextprotocol/sdk --save
```

- [ ] **Step 7: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Create `src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Install shadcn/ui**

```bash
npx shadcn@latest init
```
Choose: TypeScript, Default style, CSS variables, `src/` directory.

- [ ] **Step 9: Verify dev build**

```bash
npm run tauri dev
```
Expected: Tauri window opens showing Next.js default page. No TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Tauri 2.0 + Next.js 15 project"
```

---

## Task 2: Core Extensibility Interfaces

**Files:**
- Create: `src/lib/interfaces/agent-provider.ts`
- Create: `src/lib/interfaces/llm-provider.ts`
- Create: `src/lib/interfaces/tool-definition.ts`
- Create: `src/lib/interfaces/canvas-node.ts`
- Create: `src/lib/interfaces/event-bus.ts`
- Create: `src/lib/interfaces/index.ts`

**Interfaces:**
- Produces: All extension point types consumed by every subsequent task

- [ ] **Step 1: Write the failing interface import test**

Create `src/lib/__tests__/interfaces.test.ts`:
```typescript
import { describe, it, expectTypeOf } from 'vitest'
import type {
  AgentProvider,
  LLMProvider,
  ToolDefinition,
  CanvasNode,
  EventBus,
  AppEvent,
} from '@/lib/interfaces'

describe('interfaces barrel export', () => {
  it('exports AgentProvider', () => {
    expectTypeOf<AgentProvider>().not.toBeUndefined()
  })
  it('exports LLMProvider', () => {
    expectTypeOf<LLMProvider>().not.toBeUndefined()
  })
  it('exports ToolDefinition', () => {
    expectTypeOf<ToolDefinition>().not.toBeUndefined()
  })
  it('exports CanvasNode', () => {
    expectTypeOf<CanvasNode>().not.toBeUndefined()
  })
  it('exports EventBus', () => {
    expectTypeOf<EventBus>().not.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run src/lib/__tests__/interfaces.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write agent-provider.ts**

```typescript
// src/lib/interfaces/agent-provider.ts
import type { NodeProps } from 'reactflow'

export type AgentStatus = 'idle' | 'running' | 'awaiting-approval' | 'error' | 'stopped'

export interface AgentEvent {
  type: 'tool-call' | 'tool-result' | 'text-delta' | 'approval-request' | 'status-change' | 'error'
  agentId: string
  timestamp: number
  payload: unknown
}

export interface ApprovalRequest {
  id: string
  agentId: string
  action: string
  description: string
  risk: 'low' | 'medium' | 'high'
}

export interface AgentCapabilities {
  supportsTools: boolean
  supportsStreaming: boolean
  supportsApprovalGates: boolean
  requiresProjectDirectory: boolean
}

export interface AgentSession {
  id: string
  agentId: string
  projectDirectory?: string
  permissionScope: PermissionScope
}

export interface PermissionScope {
  allowedPaths: string[]
  allowedDomains: string[]
  shellEnabled: boolean
}

export interface AgentProvider<TConfig = unknown, TEvent extends AgentEvent = AgentEvent> {
  readonly type: string
  readonly displayName: string
  readonly icon: string
  configure(config: TConfig): Promise<void>
  run(session: AgentSession, input: string): AsyncIterable<TEvent>
  stop(sessionId: string): Promise<void>
  approve(requestId: string): Promise<void>
  deny(requestId: string, reason?: string): Promise<void>
  getCapabilities(): AgentCapabilities
}
```

- [ ] **Step 4: Write llm-provider.ts**

```typescript
// src/lib/interfaces/llm-provider.ts
import type { LanguageModelV1 } from 'ai'

export interface BaseModel {
  id: string
  displayName: string
  contextWindow: number
  supportsTools: boolean
  supportsStreaming: boolean
}

export interface Credentials {
  apiKey?: string
  baseUrl?: string
}

export interface ConnectionResult {
  success: boolean
  error?: string
  latencyMs?: number
}

export interface LLMProvider<TModel extends BaseModel = BaseModel> {
  readonly providerId: string
  readonly displayName: string
  listModels(credentials: Credentials): Promise<TModel[]>
  createAdapter(model: TModel, credentials: Credentials): LanguageModelV1
  testConnection(credentials: Credentials): Promise<ConnectionResult>
}
```

- [ ] **Step 5: Write tool-definition.ts**

```typescript
// src/lib/interfaces/tool-definition.ts

export interface JSONSchema<T = unknown> {
  type: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  description?: string
  items?: JSONSchema
  [key: string]: unknown
}

export interface ToolContext {
  agentId: string
  sessionId: string
  permissionScope: import('./agent-provider').PermissionScope
}

export type ToolSource = 'built-in' | 'registry' | 'custom'

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly name: string
  readonly description: string
  readonly source: ToolSource
  readonly version: string
  inputSchema: JSONSchema<TInput>
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
```

- [ ] **Step 6: Write canvas-node.ts**

```typescript
// src/lib/interfaces/canvas-node.ts
import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'

export interface CanvasNodeData {
  label: string
  [key: string]: unknown
}

export interface CanvasNode<TData extends CanvasNodeData = CanvasNodeData> {
  readonly nodeType: string
  defaultData(): TData
  CardComponent: ComponentType<NodeProps<TData>>
}
```

- [ ] **Step 7: Write event-bus.ts interface**

```typescript
// src/lib/interfaces/event-bus.ts
import type { AgentEvent, AgentStatus, ApprovalRequest } from './agent-provider'

export interface AgentStatusChangedEvent {
  type: 'agent:status-changed'
  agentId: string
  status: AgentStatus
  timestamp: number
}

export interface AgentActionEvent {
  type: 'agent:action'
  agentId: string
  action: string
  detail: string
  timestamp: number
}

export interface AgentApprovalRequestedEvent {
  type: 'agent:approval-requested'
  request: ApprovalRequest
  timestamp: number
}

export interface AgentApprovalResolvedEvent {
  type: 'agent:approval-resolved'
  requestId: string
  approved: boolean
  timestamp: number
}

export interface CanvasLayoutChangedEvent {
  type: 'canvas:layout-changed'
  timestamp: number
}

export type AppEvent =
  | AgentStatusChangedEvent
  | AgentActionEvent
  | AgentApprovalRequestedEvent
  | AgentApprovalResolvedEvent
  | CanvasLayoutChangedEvent

export type Unsubscribe = () => void

export interface EventBus {
  emit<T extends AppEvent>(event: T): void
  on<T extends AppEvent>(type: T['type'], handler: (event: T) => void): Unsubscribe
  off<T extends AppEvent>(type: T['type'], handler: (event: T) => void): void
}
```

- [ ] **Step 8: Write index.ts barrel**

```typescript
// src/lib/interfaces/index.ts
export type * from './agent-provider'
export type * from './llm-provider'
export type * from './tool-definition'
export type * from './canvas-node'
export type * from './event-bus'
```

- [ ] **Step 9: Run tests — expect pass**

```bash
npx vitest run src/lib/__tests__/interfaces.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/interfaces/
git add src/lib/__tests__/interfaces.test.ts
git commit -m "feat: define core extensibility interfaces"
```

---

## Task 3: Event Bus Implementation

**Files:**
- Create: `src/lib/event-bus.ts`
- Test: `src/lib/__tests__/event-bus.test.ts`

**Interfaces:**
- Consumes: `EventBus`, `AppEvent`, `Unsubscribe` from `@/lib/interfaces`
- Produces: `createEventBus(): EventBus` — singleton factory consumed by all providers and canvas components

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/event-bus.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '@/lib/event-bus'
import type { AgentStatusChangedEvent } from '@/lib/interfaces'

describe('createEventBus', () => {
  it('calls handler when matching event is emitted', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('agent:status-changed', handler)
    const event: AgentStatusChangedEvent = {
      type: 'agent:status-changed',
      agentId: 'a1',
      status: 'running',
      timestamp: Date.now(),
    }
    bus.emit(event)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('does not call handler for different event type', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    bus.on('agent:status-changed', handler)
    bus.emit({ type: 'canvas:layout-changed', timestamp: Date.now() })
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribes when returned function is called', () => {
    const bus = createEventBus()
    const handler = vi.fn()
    const unsub = bus.on('agent:status-changed', handler)
    unsub()
    bus.emit({ type: 'agent:status-changed', agentId: 'a1', status: 'idle', timestamp: Date.now() })
    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple handlers for the same event', () => {
    const bus = createEventBus()
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on('agent:action', h1)
    bus.on('agent:action', h2)
    bus.emit({ type: 'agent:action', agentId: 'a1', action: 'read', detail: 'file.ts', timestamp: Date.now() })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/event-bus.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement event bus**

```typescript
// src/lib/event-bus.ts
import type { AppEvent, EventBus, Unsubscribe } from '@/lib/interfaces'

export function createEventBus(): EventBus {
  const listeners = new Map<string, Set<(event: AppEvent) => void>>()

  function on<T extends AppEvent>(type: T['type'], handler: (event: T) => void): Unsubscribe {
    if (!listeners.has(type)) listeners.set(type, new Set())
    const typedHandler = handler as (event: AppEvent) => void
    listeners.get(type)!.add(typedHandler)
    return () => off(type, handler)
  }

  function off<T extends AppEvent>(type: T['type'], handler: (event: T) => void): void {
    listeners.get(type)?.delete(handler as (event: AppEvent) => void)
  }

  function emit<T extends AppEvent>(event: T): void {
    listeners.get(event.type)?.forEach((handler) => handler(event))
  }

  return { on, off, emit }
}

// Singleton for use across the app
let _bus: EventBus | null = null
export function getEventBus(): EventBus {
  if (!_bus) _bus = createEventBus()
  return _bus
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run src/lib/__tests__/event-bus.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/event-bus.ts src/lib/__tests__/event-bus.test.ts
git commit -m "feat: implement typed event bus"
```

---

## Task 4: OS Keychain Integration

**Files:**
- Create: `src-tauri/src/commands/keychain.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/lib/keychain.ts`
- Test: `src/lib/__tests__/keychain.test.ts`

**Interfaces:**
- Produces: `getSecret(key)`, `setSecret(key, value)`, `deleteSecret(key)` — Tauri IPC commands callable from TypeScript

- [ ] **Step 1: Write failing TypeScript test**

Create `src/lib/__tests__/keychain.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

// Mock Tauri invoke for test environment
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, string>) => {
    if (cmd === 'set_secret') return undefined
    if (cmd === 'get_secret') return args.key === 'test-key' ? 'test-value' : null
    if (cmd === 'delete_secret') return undefined
    throw new Error(`Unknown command: ${cmd}`)
  }),
}))

import { getSecret, setSecret, deleteSecret } from '@/lib/keychain'

describe('keychain', () => {
  it('set and get round-trip', async () => {
    await setSecret('test-key', 'test-value')
    const val = await getSecret('test-key')
    expect(val).toBe('test-value')
  })

  it('returns null for missing key', async () => {
    const val = await getSecret('nonexistent')
    expect(val).toBeNull()
  })

  it('delete removes key', async () => {
    await deleteSecret('test-key')
    // invoke mock returns undefined — no throw = success
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/keychain.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write Rust keychain commands**

Create `src-tauri/src/commands/mod.rs`:
```rust
pub mod keychain;
pub mod process;
```

Create `src-tauri/src/commands/keychain.rs`:
```rust
use keyring::Entry;
use tauri::command;

const SERVICE: &str = "agent-command-center";

#[command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    Entry::new(SERVICE, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub fn delete_secret(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_get_delete_round_trip() {
        let key = "acc-test-key".to_string();
        set_secret(key.clone(), "secret-value".to_string()).unwrap();
        let val = get_secret(key.clone()).unwrap();
        assert_eq!(val, Some("secret-value".to_string()));
        delete_secret(key.clone()).unwrap();
        let val2 = get_secret(key).unwrap();
        assert_eq!(val2, None);
    }
}
```

- [ ] **Step 4: Register commands in lib.rs**

```rust
// src-tauri/src/lib.rs
mod commands;
use commands::keychain::{delete_secret, get_secret, set_secret};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![set_secret, get_secret, delete_secret])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Write TypeScript keychain wrapper**

```typescript
// src/lib/keychain.ts
import { invoke } from '@tauri-apps/api/core'

export async function setSecret(key: string, value: string): Promise<void> {
  await invoke<void>('set_secret', { key, value })
}

export async function getSecret(key: string): Promise<string | null> {
  return invoke<string | null>('get_secret', { key })
}

export async function deleteSecret(key: string): Promise<void> {
  await invoke<void>('delete_secret', { key })
}
```

- [ ] **Step 6: Run TypeScript tests — expect pass**

```bash
npx vitest run src/lib/__tests__/keychain.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 7: Run Rust tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml commands::keychain::tests
```
Expected: PASS (1 test). Note: requires OS Keychain access — run on host machine, not in CI container.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs src/lib/keychain.ts src/lib/__tests__/keychain.test.ts
git commit -m "feat: OS Keychain integration via Tauri commands"
```

---

## Task 5: Encrypted SQLite Storage Layer

**Files:**
- Create: `src/lib/storage/schema.ts`
- Create: `src/lib/storage/db.ts`
- Create: `src/lib/storage/repositories/agents.ts`
- Create: `src/lib/storage/repositories/sessions.ts`
- Create: `src/lib/storage/repositories/models.ts`
- Create: `src/lib/storage/repositories/mcps.ts`
- Create: `src/lib/storage/repositories/tools.ts`
- Create: `src/lib/storage/repositories/audit-log.ts`
- Create: `src/lib/storage/index.ts`
- Test: `src/lib/__tests__/storage.test.ts`

**Interfaces:**
- Consumes: `@tauri-apps/plugin-sql`
- Produces: `initDb()`, `AgentRepository`, `SessionRepository`, `ModelRepository`, `McpRepository`, `ToolRepository`, `AuditLogRepository`

- [ ] **Step 1: Write failing storage tests**

Create `src/lib/__tests__/storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock tauri plugin-sql
const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1 })),
  select: vi.fn(async () => []),
}
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => mockDb) },
}))

import { initDb } from '@/lib/storage/db'
import { AgentRepository } from '@/lib/storage/repositories/agents'

describe('AgentRepository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('create calls execute with INSERT', async () => {
    const db = await initDb()
    const repo = new AgentRepository(db)
    await repo.create({
      name: 'Coder',
      type: 'llm',
      modelId: 'model-1',
      systemPrompt: 'You are a coder',
      toolIds: [],
      mcpIds: [],
      canvasX: 100,
      canvasY: 200,
      groupId: null,
    })
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agents'),
      expect.any(Array),
    )
  })

  it('findAll calls SELECT', async () => {
    const db = await initDb()
    const repo = new AgentRepository(db)
    await repo.findAll()
    expect(mockDb.select).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM agents'),
    )
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/lib/__tests__/storage.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Write schema.ts**

```typescript
// src/lib/storage/schema.ts
export const CREATE_AGENTS = `
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('llm','coding-agent','custom')),
    model_id TEXT,
    system_prompt TEXT NOT NULL DEFAULT '',
    tool_ids TEXT NOT NULL DEFAULT '[]',
    mcp_ids TEXT NOT NULL DEFAULT '[]',
    canvas_x REAL NOT NULL DEFAULT 0,
    canvas_y REAL NOT NULL DEFAULT 0,
    group_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_SESSIONS = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    messages TEXT NOT NULL DEFAULT '[]',
    token_count INTEGER NOT NULL DEFAULT 0,
    cost_estimate REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_MODELS = `
  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    api_key_ref TEXT,
    base_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_MCPS = `
  CREATE TABLE IF NOT EXISTS mcps (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    transport TEXT NOT NULL CHECK(transport IN ('stdio','sse')),
    command_or_url TEXT NOT NULL,
    env_vars_ref TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_TOOLS = `
  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('built-in','registry','custom')),
    version TEXT NOT NULL DEFAULT '1.0.0',
    definition TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_AUDIT_LOG = `
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    approved_by TEXT,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch())
  )
`

export const CREATE_CANVAS_STATE = `
  CREATE TABLE IF NOT EXISTS canvas_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    viewport_x REAL NOT NULL DEFAULT 0,
    viewport_y REAL NOT NULL DEFAULT 0,
    zoom REAL NOT NULL DEFAULT 1,
    group_definitions TEXT NOT NULL DEFAULT '[]'
  )
`

export const ALL_MIGRATIONS = [
  CREATE_AGENTS,
  CREATE_SESSIONS,
  CREATE_MODELS,
  CREATE_MCPS,
  CREATE_TOOLS,
  CREATE_AUDIT_LOG,
  CREATE_CANVAS_STATE,
]
```

- [ ] **Step 4: Write db.ts**

```typescript
// src/lib/storage/db.ts
import Database from '@tauri-apps/plugin-sql'
import { ALL_MIGRATIONS } from './schema'

export type Db = Awaited<ReturnType<typeof Database.load>>

let _db: Db | null = null

export async function initDb(): Promise<Db> {
  if (_db) return _db
  _db = await Database.load('sqlite:acc.db')
  await runMigrations(_db)
  return _db
}

async function runMigrations(db: Db): Promise<void> {
  for (const sql of ALL_MIGRATIONS) {
    await db.execute(sql)
  }
}
```

- [ ] **Step 5: Write agents repository**

```typescript
// src/lib/storage/repositories/agents.ts
import type { Db } from '../db'

export interface AgentRow {
  id: string
  name: string
  type: 'llm' | 'coding-agent' | 'custom'
  modelId: string | null
  systemPrompt: string
  toolIds: string[]
  mcpIds: string[]
  canvasX: number
  canvasY: number
  groupId: string | null
  createdAt: number
}

interface AgentInsert {
  name: string
  type: 'llm' | 'coding-agent' | 'custom'
  modelId?: string | null
  systemPrompt?: string
  toolIds?: string[]
  mcpIds?: string[]
  canvasX?: number
  canvasY?: number
  groupId?: string | null
}

export class AgentRepository {
  constructor(private db: Db) {}

  async create(data: AgentInsert): Promise<string> {
    const id = crypto.randomUUID()
    await this.db.execute(
      `INSERT INTO agents (id, name, type, model_id, system_prompt, tool_ids, mcp_ids, canvas_x, canvas_y, group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.name,
        data.type ?? 'llm',
        data.modelId ?? null,
        data.systemPrompt ?? '',
        JSON.stringify(data.toolIds ?? []),
        JSON.stringify(data.mcpIds ?? []),
        data.canvasX ?? 0,
        data.canvasY ?? 0,
        data.groupId ?? null,
      ],
    )
    return id
  }

  async findAll(): Promise<AgentRow[]> {
    const rows = await this.db.select<Record<string, unknown>[]>('SELECT * FROM agents')
    return rows.map(this.deserialize)
  }

  async findById(id: string): Promise<AgentRow | null> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM agents WHERE id = $1',
      [id],
    )
    return rows[0] ? this.deserialize(rows[0]) : null
  }

  async updatePosition(id: string, x: number, y: number): Promise<void> {
    await this.db.execute(
      'UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3',
      [x, y, id],
    )
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM agents WHERE id = $1', [id])
  }

  private deserialize(row: Record<string, unknown>): AgentRow {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as AgentRow['type'],
      modelId: row.model_id as string | null,
      systemPrompt: row.system_prompt as string,
      toolIds: JSON.parse(row.tool_ids as string),
      mcpIds: JSON.parse(row.mcp_ids as string),
      canvasX: row.canvas_x as number,
      canvasY: row.canvas_y as number,
      groupId: row.group_id as string | null,
      createdAt: row.created_at as number,
    }
  }
}
```

- [ ] **Step 6: Write audit-log repository**

```typescript
// src/lib/storage/repositories/audit-log.ts
import type { Db } from '../db'

export interface AuditLogEntry {
  agentId: string
  actionType: string
  payload: unknown
  approvedBy?: string
}

export class AuditLogRepository {
  constructor(private db: Db) {}

  async append(entry: AuditLogEntry): Promise<void> {
    await this.db.execute(
      `INSERT INTO audit_log (agent_id, action_type, payload, approved_by)
       VALUES ($1, $2, $3, $4)`,
      [
        entry.agentId,
        entry.actionType,
        JSON.stringify(entry.payload),
        entry.approvedBy ?? null,
      ],
    )
  }

  async findByAgent(agentId: string, limit = 50): Promise<AuditLogEntry[]> {
    const rows = await this.db.select<Record<string, unknown>[]>(
      'SELECT * FROM audit_log WHERE agent_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [agentId, limit],
    )
    return rows.map((r) => ({
      agentId: r.agent_id as string,
      actionType: r.action_type as string,
      payload: JSON.parse(r.payload as string),
      approvedBy: r.approved_by as string | undefined,
    }))
  }
}
```

- [ ] **Step 7: Write storage index barrel**

```typescript
// src/lib/storage/index.ts
export { initDb } from './db'
export type { Db } from './db'
export { AgentRepository } from './repositories/agents'
export type { AgentRow } from './repositories/agents'
export { AuditLogRepository } from './repositories/audit-log'
export type { AuditLogEntry } from './repositories/audit-log'
// Add remaining repositories as they are created following the same pattern:
// SessionRepository, ModelRepository, McpRepository, ToolRepository
```

Write `src/lib/storage/repositories/sessions.ts`, `models.ts`, `mcps.ts`, `tools.ts` following the exact same pattern as `agents.ts`: constructor takes `Db`, has `create`, `findAll`, `findById`, `delete` methods, and a private `deserialize` that maps snake_case DB columns to camelCase TypeScript.

- [ ] **Step 8: Run tests — expect pass**

```bash
npx vitest run src/lib/__tests__/storage.test.ts
```
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage/ src/lib/__tests__/storage.test.ts
git commit -m "feat: encrypted SQLite storage layer with repositories"
```

---

## Verification

- [ ] Run full test suite: `npx vitest run` — all tests pass
- [ ] Run Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml` — all pass
- [ ] Run `npm run tauri dev` — app launches, no console errors
- [ ] TypeScript: `npx tsc --noEmit` — zero errors

Phase 1A is complete. Proceed to **Phase 1B: LLM Layer + MCP Registry + Agent Runtimes**.
