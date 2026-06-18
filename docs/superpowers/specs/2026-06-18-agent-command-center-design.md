# Agent Command Center — Design Spec
**Date:** 2026-06-18  
**Status:** Approved  

---

## 1. Vision

A beautiful, personal-grade unified agent command center — a spatial canvas where AI agents from any provider are visible, controllable, and connectable in real time. Not an enterprise governance tool. A personal OS for AI that developers and creators want to open every morning.

**The gap this fills:** Existing tools are either enterprise governance platforms (boring, expensive) or single-purpose AI tools (Cursor, CapCut, Notion AI). Nothing combines creative and technical workflows in one polished, personal interface.

---

## 2. Core Principles

- **Extensibility first** — every component is built on generics, abstracts, and templates. Adding a new agent type, LLM provider, tool, or MCP never requires rewriting existing code — only implementing a well-defined interface.
- **Local-first** — data lives on the user's device by default. Cloud sync is opt-in and covers canvas state and conversation history only. API keys and credentials never leave the device regardless of sync setting.
- **Zero-trust agents** — agents can only do what the user has explicitly permitted.
- **Privacy by default** — no telemetry, no keys leaving the device, no cross-user data.
- **One codebase, two platforms** — desktop and web share the same React + Next.js codebase.

---

## 3. Architecture

### 3.1 Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.0 (Rust sidecar for process management) |
| Web app | Next.js 15 (App Router) |
| UI framework | React + TypeScript |
| Component library | shadcn/ui |
| Canvas engine | React Flow |
| LLM abstraction | Vercel AI SDK |
| Storage (local) | SQLite via Tauri plugin |
| Storage (cloud sync) | libSQL / Turso |
| MCP integration | Anthropic MCP SDK |
| Secret management | OS Keychain (Windows Credential Manager / macOS Keychain) |

### 3.2 Layers

```
Presentation    Desktop (Tauri) ←—— shared React codebase ——→ Web (Next.js 15)
                        ↓
Application     Multi-Agent Workspace · Workflow Builder · Autonomous Executor
                        ↓
Core Services   LLM Router · MCP Registry · Skills/Tools Store · Session & Memory
                        ↓
Storage         SQLite (local) · libSQL/Turso (cloud sync) · File System (Tauri FS)
```

### 3.3 Build Phases

| Phase | Scope |
|-------|-------|
| 1 — Agent Shell | Core app, LLM router, canvas, agent cards, live updates, approval gates, storage |
| 2 — Workflow Builder | Visual node graph for chaining agents and tools |
| 3 — Autonomous Executor | Goal → decompose → sub-agents → approval flow |

Each phase ships something usable on its own.

---

## 4. Extensibility Architecture

This is a first-class design constraint. Every major concept is expressed as a generic interface or abstract base that concrete implementations extend.

### 4.1 Agent Provider Interface

```typescript
interface AgentProvider<TConfig = unknown, TEvent = AgentEvent> {
  readonly type: string                          // 'llm' | 'coding-agent' | 'custom'
  readonly displayName: string
  configure(config: TConfig): Promise<void>
  run(session: AgentSession): AsyncIterable<TEvent>
  stop(sessionId: string): Promise<void>
  getCapabilities(): AgentCapabilities
}
```

Adding a new agent runtime (e.g., a future Gemini Code agent) = implement `AgentProvider`, register it. Zero changes to existing code.

### 4.2 LLM Provider Interface

```typescript
interface LLMProvider<TModel extends BaseModel = BaseModel> {
  readonly providerId: string
  listModels(): Promise<TModel[]>
  createAdapter(model: TModel, credentials: Credentials): LanguageModelV1
  testConnection(credentials: Credentials): Promise<ConnectionResult>
}
```

Vercel AI SDK's `LanguageModelV1` is the universal adapter target — every provider maps to it.

### 4.3 Tool / MCP Interfaces

```typescript
interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: JSONSchema<TInput>
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}

interface MCPServerConfig {
  transport: 'stdio' | 'sse'
  command?: string          // stdio
  url?: string              // sse
  envRef?: string[]         // keychain references
}
```

### 4.4 Canvas Node Templates

Every entity that can appear on the canvas — agent, workflow, note, group — implements `CanvasNode<TData>`. React Flow handles rendering; the template provides the data shape and card component. Adding a new card type = implement `CanvasNode`, register a React component for it.

```typescript
interface CanvasNode<TData = unknown> {
  readonly nodeType: string
  defaultData(): TData
  CardComponent: React.ComponentType<NodeProps<TData>>
}
```

### 4.5 Event Bus

A typed, generic event bus connects the Rust sidecar (process events), the LLM router (token streams), and the canvas (UI updates) without tight coupling:

```typescript
interface EventBus {
  emit<T extends AppEvent>(event: T): void
  on<T extends AppEvent>(type: T['type'], handler: (e: T) => void): Unsubscribe
}
```

---

## 5. Spatial Canvas UI

### 5.1 Layout

- **Slim icon sidebar** (left) — Home, Chat, Workflows, Store, Settings
- **Top bar** — canvas name, approval badge, zoom controls, + Agent button
- **Infinite canvas** — free-form, zoomable, pannable (Cmd+Space)
- **Minimap** — bottom-right, viewport indicator
- **Status bar** — live counts: agents running, approvals pending, LLM calls, estimated cost

### 5.2 Agent Cards

Each agent appears as a draggable card on the canvas. Cards show:
- Status indicator (Running / Approval Needed / Idle / Error) with glow effect
- Live action feed — every tool call streamed in real time
- Inline Approve / Deny buttons when a gate is triggered
- Connection ports (left/right edges) for wiring agents together
- Model + tool count in the card footer
- Drag handle (top center dots)

### 5.3 Canvas Interactions

| Interaction | Action |
|-------------|--------|
| Drag card | Move agent freely |
| Shift+drag port | Draw a live connection to another agent |
| Cmd+G | Group selected cards |
| Drag group label | Move entire group |
| Scroll | Zoom in/out |
| Cmd+Space+drag | Pan canvas |
| Double-click card | Open full agent session view |

### 5.4 Groups

Groups are dashed-border regions that cluster related agents (e.g., "Content Team"). Connections within a group can represent data flow (context passing) or sequential execution order.

---

## 6. Agent Types

### 6.1 LLM Agent

Standard chat + tool-use agent. Backed by any model via the LLM Router. Configurable system prompt, tool list, MCP list, and memory scope.

### 6.2 Coding Agent

Wraps a full agentic coding runtime as a child process managed by the Tauri Rust sidecar. Two implementations at launch:

- **Claude Code** — via `@anthropic-ai/claude-code` SDK. Spawned as a subprocess, tool calls and outputs streamed into the agent card via the SDK's event interface.
- **OpenAI Codex** — via Codex CLI/API. Same subprocess pattern, same card UI.

Both are sandboxed: filesystem access scoped to the assigned project directory, shell commands require approval unless whitelisted.

### 6.3 Custom Agent (future)

Implement `AgentProvider`, ship as a plugin. The canvas doesn't need to know what it is.

---

## 7. LLM Provider Layer

The Vercel AI SDK provides a `LanguageModelV1` interface that all providers map to. Switching models mid-session is instant — history is preserved, only the adapter swaps.

| Provider | Adapter | Notes |
|----------|---------|-------|
| Anthropic Claude | `@ai-sdk/anthropic` | API key in OS Keychain |
| OpenAI / GPT | `@ai-sdk/openai` | API key in OS Keychain |
| Google Gemini | `@ai-sdk/google` | API key in OS Keychain |
| Ollama (local) | `@ai-sdk/ollama` | `localhost:11434`, no key |
| LM Studio (local) | OpenAI-compatible | Custom `base_url` |
| Any OpenAI-compatible | OpenAI adapter + `base_url` | Groq, Together, etc. |

Adding a new provider = implement `LLMProvider<TModel>`, register it. The model picker in every agent card updates automatically.

---

## 8. MCP / Tools / Skills Registry

### 8.1 MCPs

Managed via the Anthropic MCP SDK. Each server runs in its own isolated process. Transport options: `stdio` (local) or `sse` (remote). Env vars stored in OS Keychain, never in the database.

### 8.2 Tools

Three tiers, all implementing `ToolDefinition<TInput, TOutput>`:
1. **Built-in** — web search, file read/write, shell, browser, image generation
2. **Registry** — installable community tools (npm-like, versioned). The registry itself is future scope (Phase 2+); Phase 1 ships with local install from a file path or URL only.
3. **Custom** — user-defined JSON Schema + implementation

### 8.3 Skills

Markdown files with YAML frontmatter. Stored in `~/.acc/skills/`. The app ships a built-in library; community skills and custom skills are installed the same way. Skills are assigned per-agent.

### 8.4 Store UI

A dedicated panel (📦 sidebar) for browsing, installing, updating, and assigning all three. Each item shows: description, assigned agents, version, install/uninstall/assign toggles.

---

## 9. Security & Sandboxing

### 9.1 Principles

**Local-first · Zero-trust agents · Explicit permissions · Encrypted at rest · Auditable · Privacy by default**

### 9.2 User Vault

- API keys and tokens stored exclusively in OS Keychain (Windows Credential Manager / macOS Keychain). Never written to SQLite.
- SQLite database encrypted at rest (SQLCipher).
- Desktop: local passphrase unlocks the vault on launch. Web: OAuth / JWT.
- Per-user isolated databases — no shared tables, no cross-user data access.

### 9.3 Agent Sandboxing

- Every agent run gets an explicit permission scope (filesystem paths, allowed domains, shell on/off).
- Destructive or out-of-scope actions surface as approval gates on the canvas card before executing.
- Full audit log (`audit_log` table) — append-only, every tool call recorded with timestamp, agent, action, and approval decision.
- MCP servers run in isolated processes; one crashing doesn't affect others.

### 9.4 Tauri Capability Model

Every OS capability must be declared in `tauri.conf.json`:
- Filesystem: scoped to user-chosen folders only
- Network: allowlisted domains per agent
- Shell: disabled by default, opt-in per tool

### 9.5 Web / Distribution

- Strict Content Security Policy — no inline scripts, no eval
- Sandboxed iframes for any third-party content
- No telemetry by default — opt-in only, clearly disclosed
- GDPR-ready: full data export and delete per user
- Row-level security on all cloud sync tables

---

## 10. Data Model

Core SQLite tables (encrypted per user):

| Table | Key Fields |
|-------|-----------|
| `agents` | id, name, type, model_id, system_prompt, tool_ids[], mcp_ids[], canvas_x/y, group_id |
| `sessions` | id, agent_id, messages (JSON), token_count, cost_estimate |
| `shared_memory` | key, value, scope (agent-local \| group-wide) |
| `models` | id, provider, model_name, api_key_ref, base_url |
| `tools` | id, name, definition (JSON schema), source |
| `mcps` | id, name, transport, command_or_url, env_vars_ref, enabled |
| `workflows` | id, name, nodes (React Flow JSON), edges (React Flow JSON) |
| `canvas_state` | viewport_x/y, zoom, group_definitions (JSON) |
| `audit_log` | agent_id, action_type, payload, approved_by, timestamp — **append-only** |

---

## 11. Out of Scope (for Phase 1)

- Mobile app
- Vector DB / semantic memory search
- Marketplace for sharing agents/workflows publicly
- Real-time collaboration (multi-user same canvas)
- Video editing agent implementation (card present, runtime later)
