/**
 * The application event bus contract and its event vocabulary.
 *
 * A typed, in-process pub/sub channel that decouples event producers (agent
 * runtimes, the canvas) from consumers (the React UI, via hooks). The full set
 * of events that can flow through the bus is the {@link AppEvent} union; the
 * concrete implementation lives in `src/lib/event-bus.ts`.
 *
 * @module
 */
import type { AgentEvent, AgentStatus, ApprovalRequest } from './agent-provider'

/** An agent moved between lifecycle states. */
export interface AgentStatusChangedEvent {
  type: 'agent:status-changed'
  agentId: string
  status: AgentStatus
  timestamp: number
}

/** An agent performed a discrete action (tool call, message), for the feed. */
export interface AgentActionEvent {
  type: 'agent:action'
  agentId: string
  action: string
  detail: string
  timestamp: number
}

/** An agent paused and is waiting for an approval decision. */
export interface AgentApprovalRequestedEvent {
  type: 'agent:approval-requested'
  request: ApprovalRequest
  timestamp: number
}

/** A previously requested approval was approved or denied. */
export interface AgentApprovalResolvedEvent {
  type: 'agent:approval-resolved'
  requestId: string
  approved: boolean
  timestamp: number
}

/** The canvas layout (positions, groups, viewport) changed. */
export interface CanvasLayoutChangedEvent {
  type: 'canvas:layout-changed'
  timestamp: number
}

/** Every event that can travel on the bus. Discriminated by `type`. */
export type AppEvent =
  | AgentStatusChangedEvent
  | AgentActionEvent
  | AgentApprovalRequestedEvent
  | AgentApprovalResolvedEvent
  | CanvasLayoutChangedEvent

/** Returned by {@link EventBus.on}; call it to remove the listener. */
export type Unsubscribe = () => void

/**
 * Typed pub/sub over {@link AppEvent}.
 *
 * Handlers are matched by the event's `type` discriminant, and TypeScript
 * narrows the handler argument to the matching event variant.
 */
export interface EventBus {
  /** Publish an event to all listeners registered for its `type`. */
  emit<T extends AppEvent>(event: T): void
  /** Subscribe to one event `type`; returns an {@link Unsubscribe}. */
  on<T extends AppEvent>(type: T['type'], handler: (event: T) => void): Unsubscribe
  /** Remove a previously registered handler. */
  off<T extends AppEvent>(type: T['type'], handler: (event: T) => void): void
}
