/**
 * The agent runtime contract.
 *
 * An {@link AgentProvider} adapts any kind of agent — an LLM chat loop, a
 * subprocess-backed coding agent, a future custom plugin — to a single
 * streaming interface the canvas understands. Concrete providers live in
 * `src/lib/agents/` and are wired up in `AGENT_REGISTRY`; adding a new runtime
 * means implementing this interface and registering it, with no changes to the
 * canvas or the rest of the app.
 *
 * @module
 */
import type { NodeProps } from 'reactflow'

/** Lifecycle state of an agent, surfaced on its canvas card. */
export type AgentStatus = 'idle' | 'running' | 'awaiting-approval' | 'error' | 'stopped'

/**
 * A single event streamed out of a running agent.
 *
 * Providers yield these from {@link AgentProvider.run}; the UI maps them onto
 * the agent card (action feed, status glow, approval prompts). `payload` is
 * intentionally untyped — its shape depends on `type` and the provider.
 */
export interface AgentEvent {
  type: 'tool-call' | 'tool-result' | 'text-delta' | 'approval-request' | 'status-change' | 'error'
  agentId: string
  timestamp: number
  payload: unknown
}

/** A pending action that needs explicit user sign-off before it runs. */
export interface ApprovalRequest {
  id: string
  agentId: string
  action: string
  description: string
  /** Severity hint used to style the approval prompt. */
  risk: 'low' | 'medium' | 'high'
}

/** What a provider can do, used by the UI to show/hide affordances. */
export interface AgentCapabilities {
  supportsTools: boolean
  supportsStreaming: boolean
  supportsApprovalGates: boolean
  /** True for coding agents that must be pointed at a working directory. */
  requiresProjectDirectory: boolean
}

/** A single run of an agent, scoped to one set of permissions. */
export interface AgentSession {
  id: string
  agentId: string
  /** Working directory for coding agents; ignored by pure LLM agents. */
  projectDirectory?: string
  permissionScope: PermissionScope
}

/**
 * The sandbox boundary for an agent run.
 *
 * Everything an agent may touch is enumerated here; anything not listed is
 * denied. Out-of-scope actions are expected to surface as approval gates rather
 * than silently failing.
 */
export interface PermissionScope {
  allowedPaths: string[]
  allowedDomains: string[]
  shellEnabled: boolean
}

/**
 * Adapts an agent runtime to the canvas.
 *
 * @typeParam TConfig - Provider-specific configuration shape passed to {@link configure}.
 * @typeParam TEvent  - Event type streamed from {@link run}; defaults to {@link AgentEvent}.
 */
export interface AgentProvider<TConfig = unknown, TEvent extends AgentEvent = AgentEvent> {
  /** Stable runtime identifier, e.g. `'llm'`, `'claude-code'`, `'codex'`. */
  readonly type: string
  /** Human-readable name shown in the UI. */
  readonly displayName: string
  /** Emoji or icon key shown on the agent card. */
  readonly icon: string
  /** Apply provider-specific configuration before the first run. */
  configure(config: TConfig): Promise<void>
  /**
   * Run the agent against `input`, streaming events as they happen.
   *
   * Implemented as an async generator: the caller pulls events and forwards
   * them to the canvas. The stream ends when the agent finishes, errors, or is
   * stopped via {@link stop}.
   */
  run(session: AgentSession, input: string): AsyncIterable<TEvent>
  /** Stop a running session and release its resources. */
  stop(sessionId: string): Promise<void>
  /** Resolve a pending approval request, allowing the action to proceed. */
  approve(requestId: string): Promise<void>
  /** Reject a pending approval request, optionally recording why. */
  deny(requestId: string, reason?: string): Promise<void>
  /** Report what this provider supports so the UI can adapt. */
  getCapabilities(): AgentCapabilities
}
