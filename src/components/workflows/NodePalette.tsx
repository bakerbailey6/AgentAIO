'use client'
// src/components/workflows/NodePalette.tsx
import type { JSX } from 'react'
import { useMemo } from 'react'
import { listWorkflowNodes } from '@/lib/workflows/node-registry'
import type { WorkflowNodeDef } from '@/lib/interfaces'

export interface NodePaletteProps {
  /** Called with a node def's `type` when its palette button is clicked. */
  onAdd: (type: string) => void
}

/** Human label for a node category, used as a group heading. */
const CATEGORY_LABELS: Record<WorkflowNodeDef['category'], string> = {
  io: 'I/O',
  compute: 'Compute',
  control: 'Control',
}

/** Stable display order for category groups; unknown categories fall to the end. */
const CATEGORY_ORDER: WorkflowNodeDef['category'][] = ['io', 'compute', 'control']

/**
 * Left-rail palette of workflow node types, read from `WORKFLOW_NODE_REGISTRY`.
 * Each registered def renders as an add button (icon + label) grouped by
 * `category`; clicking one calls `onAdd(def.type)`.
 */
export function NodePalette({ onAdd }: NodePaletteProps): JSX.Element {
  const groups = useMemo(() => {
    const byCategory = new Map<WorkflowNodeDef['category'], WorkflowNodeDef[]>()
    for (const def of listWorkflowNodes()) {
      const list = byCategory.get(def.category)
      if (list) list.push(def)
      else byCategory.set(def.category, [def])
    }
    return [...byCategory.entries()].sort(
      ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    )
  }, [])

  return (
    <div className="flex flex-col gap-3 w-48 shrink-0 bg-[#0d0d0f] border-r border-white/[0.08] p-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 px-1">
        Nodes
      </h2>
      {groups.map(([category, defs]) => (
        <div key={category} className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 px-1">
            {CATEGORY_LABELS[category] ?? category}
          </span>
          {defs.map((def) => (
            <button
              key={def.type}
              type="button"
              onClick={() => onAdd(def.type)}
              className="flex items-center gap-2 w-full text-left text-[13px] text-zinc-300 bg-white/[0.03] border border-white/[0.08] rounded-md px-2.5 py-1.5 hover:bg-white/[0.06] hover:border-indigo-500/50 hover:text-zinc-100 transition-all"
            >
              <span className="text-[14px] leading-none shrink-0" aria-hidden="true">
                {def.icon}
              </span>
              <span className="truncate">{def.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
