'use client'
/**
 * The `conditional` node: routes its input down one of two branches.
 *
 * It evaluates a *structured* predicate (`{path, op, value}`) against the input
 * via {@link evalPredicate} (no `eval`, §9.3 zero-trust) and forwards the input
 * on exactly one output port — `true` when the predicate passes, `false`
 * otherwise. Producing only one port lets the engine prune the other branch.
 *
 * @module
 */
import { createElement } from 'react'
import type { WorkflowNodeDef, NodeConfig } from '@/lib/interfaces'
import { evalPredicate, type PredicateOp } from '@/lib/workflows/expr'

/** Per-instance config for a {@link ConditionalNodeDef}: the predicate to test. */
export interface ConditionalConfig extends NodeConfig {
  /** Optional dot-path into the input; omitted means the whole input. */
  path?: string
  op: PredicateOp
  /** Comparison operand for eq/neq/gt/lt (ignored by truthy/falsy). */
  value?: unknown
}

/** The operators offered in the {@link ConditionalNodeDef} config editor. */
const OPS: PredicateOp[] = ['truthy', 'falsy', 'eq', 'neq', 'gt', 'lt']

/** Control-flow node: forwards its input to the `true` or `false` branch. */
export const ConditionalNodeDef: WorkflowNodeDef<ConditionalConfig> = {
  type: 'conditional',
  category: 'control',
  label: 'Conditional',
  icon: '🔀',
  ports: () => ({
    inputs: [{ name: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { name: 'true', label: 'True', type: 'any' },
      { name: 'false', label: 'False', type: 'any' },
    ],
  }),
  defaultConfig: () => ({ op: 'truthy' }),
  ConfigPanel: ({ config, onChange }) =>
    createElement(
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
          'Operator',
        ),
        createElement(
          'select',
          {
            value: config.op,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({ ...config, op: e.target.value as PredicateOp }),
            className:
              'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
          },
          OPS.map((op) => createElement('option', { key: op, value: op }, op)),
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
          'Path',
        ),
        createElement('input', {
          type: 'text',
          value: config.path ?? '',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...config, path: e.target.value }),
          className:
            'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
        }),
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
          'Value',
        ),
        createElement('input', {
          type: 'text',
          value: config.value == null ? '' : String(config.value),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange({ ...config, value: e.target.value }),
          className:
            'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
        }),
      ),
    ),
  execute: async (ctx, config) => {
    const passed = evalPredicate(ctx.inputs.input, {
      path: config.path,
      op: config.op,
      value: config.value,
    })
    ctx.report('done', passed ? 'true' : 'false')
    return passed ? { true: ctx.inputs.input } : { false: ctx.inputs.input }
  },
}
