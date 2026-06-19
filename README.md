# Agent Command Center

A beautiful, personal-grade command center for AI agents — a spatial canvas where agents from any
provider are visible, controllable, and connectable in real time. Run an LLM chat agent, a Claude Code
session, and an OpenAI Codex session side by side on one infinite canvas, wire them together, and approve
their actions as they happen.

Built to run as both a **desktop app** (Tauri) and a **web app** (Next.js) from a single React codebase.

> **Status:** Phase 1 (Agent Shell). The canvas, LLM router, agent runtimes, approval gates, and local
> storage are in place. Workflow Builder and the Autonomous Executor are planned — see
> [the design spec](docs/superpowers/specs/2026-06-18-agent-command-center-design.md).

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Rust** (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) — only needed
  for the desktop build
- An API key for at least one LLM provider (Anthropic, OpenAI, or a local Ollama instance)

### Run in the browser

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> Note: in browser-only mode the Tauri-backed features — OS keychain secret storage and child-process
> agents (Claude Code / Codex) — are unavailable, because they are implemented as native commands in the
> Rust sidecar. Use the desktop build to exercise the full feature set.

### Run as a desktop app

```bash
npm install
npm run tauri:dev
```

This launches the Next.js dev server and the Tauri shell together.

---

## Features

- **Spatial canvas** — every agent is a draggable card on an infinite, zoomable [React Flow](https://reactflow.dev) canvas. Group cards, wire them together, and watch a live action feed on each.
- **Any agent, any provider** — LLM chat agents (via the [Vercel AI SDK](https://ai-sdk.dev)) plus full agentic coding runtimes (Claude Code, OpenAI Codex) running as managed child processes.
- **Pluggable LLM router** — Anthropic, OpenAI, and Ollama ship in the box; switch the model behind any agent without losing history.
- **Approval gates** — destructive or out-of-scope agent actions surface as inline Approve / Deny prompts on the card before they execute.
- **MCP support** — connect [Model Context Protocol](https://modelcontextprotocol.io) servers over `stdio` or `sse` and expose their tools to agents.
- **Local-first storage** — agents, sessions, models, tools, MCPs, and canvas layout persist to a local SQLite database. API keys live in the OS keychain, never in the database.
- **Tools & Skills store** — a panel for browsing, installing, and assigning tools, MCPs, and skills per agent.

---

## Architecture

```
Presentation    Desktop (Tauri) ←— shared React codebase —→ Web (Next.js)
                        ↓
Core services   LLM Router · Agent Registry · MCP Registry · Event Bus
                        ↓
Storage         SQLite (local) · OS Keychain (secrets) · Rust process sidecar
```

The codebase is built around **pluggable registries**. Adding a new agent runtime, LLM provider, or
canvas node type means implementing one interface and registering it — no changes to existing code.

| Concept | Interface | Registry |
|---------|-----------|----------|
| Agent runtime | [`AgentProvider`](src/lib/interfaces/agent-provider.ts) | [`AGENT_REGISTRY`](src/lib/agents/registry.ts) |
| LLM provider | [`LLMProvider`](src/lib/interfaces/llm-provider.ts) | [`PROVIDER_REGISTRY`](src/lib/llm/providers/index.ts) |
| Canvas node | [`CanvasNode`](src/lib/interfaces/canvas-node.ts) | [`NODE_REGISTRY`](src/lib/canvas/node-registry.ts) |
| Tool | [`ToolDefinition`](src/lib/interfaces/tool-definition.ts) | (Phase 2) |

The **event bus** ([`src/lib/event-bus.ts`](src/lib/event-bus.ts)) is the decoupling layer: the Rust
sidecar emits process events, agent runtimes emit status and action events, and the React UI subscribes
to update cards in real time.

For the full design rationale, see the
[design spec](docs/superpowers/specs/2026-06-18-agent-command-center-design.md).

### Project structure

```
src/
  app/                      Next.js App Router entry (page.tsx is the canvas shell)
  components/
    canvas/                 React Flow canvas, agent cards, edges, groups
    agents/  approval/      Agent creation panel, approval gate
    chat/    settings/       Chat panel, model/provider settings
    layout/  store/  ui/     Sidebar, top/status bars, tools store, shadcn primitives
  hooks/                    React hooks bridging the event bus to component state
  lib/
    interfaces/             The extensibility contracts (start here)
    agents/                 AgentProvider implementations + registry
    llm/                    LLM router and provider implementations
    canvas/                 Node registry and canvas persistence
    mcp/                    MCP server registry
    storage/                SQLite schema, db, and per-table repositories
    event-bus.ts            Typed in-process pub/sub
    keychain.ts             OS keychain access (via Tauri)
src-tauri/                  Rust sidecar: keychain + child-process commands
e2e/                        Playwright end-to-end tests
docs/                       Design spec and implementation plans
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server (web mode) |
| `npm run build` | Production build of the web app |
| `npm run start` | Serve the production web build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit/component suite |
| `npm run tauri:dev` | Run the desktop app in development |
| `npm run tauri:build` | Build a distributable desktop binary |

End-to-end tests use Playwright (`playwright.config.ts`); run them with `npx playwright test`.

---

## Security model

- **API keys never touch the database.** Secrets are stored in the OS keychain (Windows Credential
  Manager / macOS Keychain / libsecret) via the Rust `set_secret` / `get_secret` commands. The database
  stores only a *reference* to the keychain entry.
- **Zero-trust agents.** Each agent run carries an explicit permission scope (allowed paths, allowed
  domains, shell on/off). Coding agents are sandboxed to an assigned project directory.
- **Approval gates.** Sensitive actions pause and wait for an explicit Approve / Deny before executing.
- **Auditable.** Tool calls and approval decisions are recorded in an append-only `audit_log` table.

---

## License

[MIT](LICENSE) © 2026
```