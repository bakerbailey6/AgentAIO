'use client'
/**
 * The `loop` node: iterate a saved sub-workflow once per input item.
 *
 * Given an array on its `items` input, the loop runs the configured
 * sub-workflow ({@link LoopConfig.subWorkflowId}) once per element — sequentially
 * — collecting each run's `output` into a `results` array. The iteration count is
 * bounded by {@link LoopConfig.maxIterations} so a large input can't spawn a
 * runaway number of sub-runs.
 *
 * To avoid a static import cycle (`node-registry.ts` imports every node def,
 * including this one), the registry is **lazy-imported** inside `execute` rather
 * than at module load time. Static imports of the engine, graph, and storage are
 * fine — none of those import this module.
 *
 * @module
 */
import { createElement, useEffect, useState } from 'react'
import type { WorkflowNodeDef, NodeConfig } from '@/lib/interfaces'
import { runWorkflow } from '@/lib/workflows/engine'
import { normalizeGraph } from '@/lib/workflows/graph'
import { initDb, WorkflowRepository } from '@/lib/storage'

/** Per-instance config for a {@link LoopNodeDef}. */
export interface LoopConfig extends NodeConfig {
  /** Id of the saved workflow to run once per input item. */
  subWorkflowId?: string
  /** Upper bound on iterations; exceeding it is a run error. Defaults to 100. */
  maxIterations?: number
}

/** Right-rail editor: pick a sub-workflow and cap the iteration count. */
function LoopConfigPanel({
  config,
  onChange,
}: {
  config: LoopConfig
  onChange: (c: LoopConfig) => void
}) {
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await new WorkflowRepository(await initDb()).findAll()
        if (!cancelled) setWorkflows(rows.map((r) => ({ id: r.id, name: r.name })))
      } catch {
        // Web mode / no DB: leave the list empty rather than crash the panel.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return createElement(
    'div',
    { className: 'space-y-3' },
    createElement(
      'div',
      { className: 'space-y-1.5' },
      createElement(
        'label',
        {
          className:
            'block text-[11px] font-medium text-zinc-500 uppercase tracking-wider',
        },
        'Sub-workflow',
      ),
      createElement(
        'select',
        {
          value: config.subWorkflowId ?? '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, subWorkflowId: e.target.value || undefined }),
          className:
            'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
        },
        createElement('option', { value: '' }, 'Select a workflow…'),
        ...workflows.map((w) =>
          createElement('option', { key: w.id, value: w.id }, w.name),
        ),
      ),
    ),
    createElement(
      'div',
      { className: 'space-y-1.5' },
      createElement(
        'label',
        {
          className:
            'block text-[11px] font-medium text-zinc-500 uppercase tracking-wider',
        },
        'Max iterations',
      ),
      createElement('input', {
        type: 'number',
        min: 1,
        value: config.maxIterations ?? 100,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ ...config, maxIterations: Math.max(1, Number(e.target.value) || 1) }),
        className:
          'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
      }),
    ),
  )
}

/** Control node: run a saved sub-workflow once per input item, bounded. */
export const LoopNodeDef: WorkflowNodeDef<LoopConfig> = {
  type: 'loop',
  category: 'control',
  label: 'Loop',
  icon: '🔁',
  ports: () => ({
    inputs: [{ name: 'items', label: 'Items', type: 'json' }],
    outputs: [{ name: 'results', label: 'Results', type: 'json' }],
  }),
  defaultConfig: () => ({ maxIterations: 100 }),
  ConfigPanel: LoopConfigPanel,
  execute: async (ctx, config) => {
    if (!config.subWorkflowId) {
      throw new Error('loop node has no sub-workflow selected')
    }

    const items = Array.isArray(ctx.inputs.items) ? ctx.inputs.items : []
    const cap = config.maxIterations ?? 100
    if (items.length > cap) {
      throw new Error(`loop exceeds maxIterations (${cap})`)
    }

    const db = await initDb()
    const row = await new WorkflowRepository(db).findById(config.subWorkflowId)
    if (!row) {
      throw new Error(`sub-workflow ${config.subWorkflowId} not found`)
    }
    const graph = normalizeGraph(
      row.nodes as Parameters<typeof normalizeGraph>[0],
      row.edges as Parameters<typeof normalizeGraph>[1],
    )

    // Lazy import to avoid the node-registry ↔ loop static import cycle.
    const { WORKFLOW_NODE_REGISTRY } = await import('@/lib/workflows/node-registry')

    const results: unknown[] = []
    for (let i = 0; i < items.length; i++) {
      ctx.report?.('running', `item ${i + 1}/${items.length}`)
      const r = await runWorkflow(graph, items[i], {
        runId: `${ctx.runId}:loop:${i}`,
        permissionScope: ctx.permissionScope,
        registry: WORKFLOW_NODE_REGISTRY,
      })
      results.push(r.output)
    }

    return { results }
  },
}
