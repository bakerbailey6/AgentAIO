'use client'
/**
 * The `join` node: a synchronization point that merges multiple inputs.
 *
 * Its `count` config decides how many input ports it exposes (`in1..inN`); the
 * engine schedules it only once every connected input has a value. `execute`
 * returns all gathered inputs as a single object on its `value` output, so a
 * downstream node receives the merged result.
 *
 * @module
 */
import { createElement } from 'react'
import type { WorkflowNodeDef, NodeConfig } from '@/lib/interfaces'

/** Per-instance config for a {@link JoinNodeDef}: the number of input ports. */
export interface JoinConfig extends NodeConfig {
  count: number
}

/** Synchronization node: exposes N inputs and merges them into one object. */
export const JoinNodeDef: WorkflowNodeDef<JoinConfig> = {
  type: 'join',
  category: 'control',
  label: 'Join',
  icon: '⛙',
  ports: (config) => ({
    inputs: Array.from({ length: config.count }, (_, i) => ({
      name: `in${i + 1}`,
      label: `In ${i + 1}`,
      type: 'any' as const,
    })),
    outputs: [{ name: 'value', label: 'Value', type: 'json' }],
  }),
  defaultConfig: () => ({ count: 2 }),
  ConfigPanel: ({ config, onChange }) =>
    createElement(
      'div',
      { className: 'space-y-1.5' },
      createElement(
        'label',
        {
          className:
            'block text-[11px] font-medium text-zinc-500 uppercase tracking-wider',
        },
        'Inputs',
      ),
      createElement('input', {
        type: 'number',
        min: 1,
        value: config.count,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChange({ ...config, count: Math.max(1, Number(e.target.value) || 1) }),
        className:
          'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
      }),
    ),
  execute: async (ctx) => ({ value: ctx.inputs }),
}
