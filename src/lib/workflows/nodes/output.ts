/**
 * The `output` node: the terminal of a workflow.
 *
 * It has a single `value` input and no outputs. Its `execute` returns nothing —
 * the engine reads this node's gathered inputs as the workflow's run result, so
 * the node itself has no work to do and nothing to configure.
 *
 * @module
 */
import { createElement } from 'react'
import type { WorkflowNodeDef } from '@/lib/interfaces'

/** Terminal node: the engine reads its gathered inputs as the run result. */
export const OutputNodeDef: WorkflowNodeDef = {
  type: 'output',
  category: 'io',
  label: 'Output',
  icon: '⏹',
  ports: () => ({
    inputs: [{ name: 'value', label: 'Value', type: 'any' }],
    outputs: [],
  }),
  defaultConfig: () => ({}),
  ConfigPanel: () =>
    createElement(
      'p',
      { className: 'text-[12px] text-zinc-500' },
      'The workflow result is whatever is connected here.',
    ),
  execute: async () => ({}),
}
