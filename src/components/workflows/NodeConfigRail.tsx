'use client'
/**
 * The workflow-builder right-rail config editor.
 *
 * Given the currently-selected node, resolves its {@link WorkflowNodeDef} from
 * {@link WORKFLOW_NODE_REGISTRY} and renders the def's `ConfigPanel`, bubbling
 * config edits up through `onChange`. Renders nothing when no node is selected,
 * and a muted note when the node's type has no registered def.
 *
 * @module
 */
import { X } from 'lucide-react'
import type { JSX } from 'react'
import type { NodeConfig } from '@/lib/interfaces'
import { WORKFLOW_NODE_REGISTRY } from '@/lib/workflows/node-registry'

export interface NodeConfigRailProps {
  node: { id: string; type: string; config: NodeConfig } | null
  onChange: (config: NodeConfig) => void
  onClose: () => void
}

export function NodeConfigRail({
  node,
  onChange,
  onClose,
}: NodeConfigRailProps): JSX.Element | null {
  if (!node) return null

  const def = WORKFLOW_NODE_REGISTRY.get(node.type)
  const ConfigPanel = def?.ConfigPanel

  return (
    <div className="flex flex-col w-80 shrink-0 h-full bg-[#0d0d0f] border-l border-white/[0.08]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="text-[13px] font-semibold text-zinc-200">
          {def?.label ?? 'Node'}
        </div>
        <button
          onClick={onClose}
          aria-label="Close config"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {ConfigPanel ? (
          <ConfigPanel config={node.config} onChange={onChange} />
        ) : (
          <p className="text-[13px] text-zinc-600">Unknown node type</p>
        )}
      </div>
    </div>
  )
}
