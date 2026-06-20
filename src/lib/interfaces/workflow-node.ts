/**
 * The workflow node contract.
 *
 * Every node type that can appear in a workflow graph — `start`, `agent`,
 * `tool`, `output`, `join`, and the future control-flow nodes — implements
 * {@link WorkflowNodeDef}. A definition pairs a stable `type` with its typed
 * ports, a config shape + editor panel, and (for data/compute nodes) an
 * `execute`. Definitions are collected in `WORKFLOW_NODE_REGISTRY`
 * (`src/lib/workflows/node-registry.ts`); adding a node type means implementing
 * this interface and registering it — the engine and editor need no changes.
 *
 * @module
 */
import type { ComponentType } from 'react'
import type { PermissionScope } from './agent-provider'

/** Advisory type of a port's value (UI hint + light validation in the editor). */
export type PortType = 'text' | 'json' | 'any'

/** A single named port on a node. */
export interface PortDef {
  /** Stable id, unique within the node's input set / output set. */
  name: string
  label: string
  type: PortType
}

/** Per-node-instance configuration, persisted in the node's data. */
export type NodeConfig = Record<string, unknown>

/** Lifecycle state of a node within a run. */
export type NodeRunStatus = 'pending' | 'running' | 'done' | 'error'

/** Runtime context handed to a node's {@link WorkflowNodeDef.execute}. */
export interface WorkflowNodeContext {
  /** Input values keyed by input-port name. */
  inputs: Record<string, unknown>
  nodeId: string
  runId: string
  /** Sandbox boundary for agent/tool steps (mirrors `AgentSession`). */
  permissionScope: PermissionScope
  /** Emit a status/log line for this node (the engine wires it to the bus). */
  report: (status: NodeRunStatus, detail?: string) => void
}

/**
 * Registers a node type with the workflow engine and editor.
 *
 * @typeParam TConfig - The node's per-instance config shape.
 */
export interface WorkflowNodeDef<TConfig extends NodeConfig = NodeConfig> {
  /** Stable type key, e.g. `'agent'`, `'tool'`, `'conditional'`. */
  readonly type: string
  readonly category: 'io' | 'compute' | 'control'
  readonly label: string
  readonly icon: string
  /** Ports may depend on config (e.g. `join` exposes N inputs). */
  ports(config: TConfig): { inputs: PortDef[]; outputs: PortDef[] }
  /** Initial config for a freshly created node. */
  defaultConfig(): TConfig
  /** Right-rail editor for this node's config. */
  ConfigPanel: ComponentType<{ config: TConfig; onChange: (c: TConfig) => void }>
  /**
   * Execute a data/compute node, returning a value per output-port name.
   * Control-flow nodes are handled specially by the engine and may omit this.
   */
  execute?(ctx: WorkflowNodeContext, config: TConfig): Promise<Record<string, unknown>>
}
