/**
 * The `start` node: the entry point of a workflow.
 *
 * It has no inputs; the engine injects the run input on the synthetic
 * `__runInput` pseudo-input before scheduling, and this node simply forwards it
 * on its single `value` output port. There is nothing to configure — the value
 * is provided at run time.
 *
 * @module
 */
import { createElement } from 'react'
import type { WorkflowNodeDef } from '@/lib/interfaces'

/** Entry node: forwards the engine-injected run input on its `value` port. */
export const StartNodeDef: WorkflowNodeDef = {
  type: 'start',
  category: 'io',
  label: 'Start',
  icon: '▶',
  ports: () => ({
    inputs: [],
    outputs: [{ name: 'value', label: 'Value', type: 'any' }],
  }),
  defaultConfig: () => ({}),
  ConfigPanel: () =>
    createElement(
      'p',
      { className: 'text-[12px] text-zinc-500' },
      'Provided at run time.',
    ),
  execute: async (ctx) => ({ value: ctx.inputs.__runInput }),
}
