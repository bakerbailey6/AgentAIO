/**
 * Registry of {@link WorkflowNodeDef}s, keyed by `type`.
 *
 * Mirrors the canvas `NODE_REGISTRY`/`TOOL_REGISTRY` pattern: add a new workflow
 * node type by implementing `WorkflowNodeDef` and {@link registerWorkflowNode}.
 * The five built-in node types are registered at module load (bottom of file).
 *
 * @module
 */
import type { WorkflowNodeDef } from '@/lib/interfaces'
import { StartNodeDef } from './nodes/start'
import { AgentNodeDef } from './nodes/agent'
import { ToolNodeDef } from './nodes/tool'
import { OutputNodeDef } from './nodes/output'
import { JoinNodeDef } from './nodes/join'
import { ConditionalNodeDef } from './nodes/conditional'
import { TransformNodeDef } from './nodes/transform'
import { LoopNodeDef } from './nodes/loop'

export const WORKFLOW_NODE_REGISTRY = new Map<string, WorkflowNodeDef>()

/** Register (or replace) a workflow node definition under its `type`. */
export function registerWorkflowNode(def: WorkflowNodeDef): void {
  WORKFLOW_NODE_REGISTRY.set(def.type, def)
}

/** List every registered workflow node definition. */
export function listWorkflowNodes(): WorkflowNodeDef[] {
  return [...WORKFLOW_NODE_REGISTRY.values()]
}

// Register built-in node types. The typed defs (`WorkflowNodeDef<AgentNodeConfig>`
// etc.) aren't assignable to the default `WorkflowNodeDef<NodeConfig>` because the
// generic is invariant through `ConfigPanel`/`onChange`; cast at the boundary,
// mirroring how the canvas `NODE_REGISTRY` registers its typed defs.
registerWorkflowNode(StartNodeDef)
registerWorkflowNode(AgentNodeDef as unknown as WorkflowNodeDef)
registerWorkflowNode(ToolNodeDef as unknown as WorkflowNodeDef)
registerWorkflowNode(OutputNodeDef)
registerWorkflowNode(JoinNodeDef as unknown as WorkflowNodeDef)
registerWorkflowNode(ConditionalNodeDef as unknown as WorkflowNodeDef)
registerWorkflowNode(TransformNodeDef as unknown as WorkflowNodeDef)
registerWorkflowNode(LoopNodeDef as unknown as WorkflowNodeDef)
