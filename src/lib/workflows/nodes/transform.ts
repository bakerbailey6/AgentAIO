'use client'
/**
 * The `transform` node: reshape an input via a safe `{{path}}` template.
 *
 * `execute` renders `config.template` against `{ input }` using the eval-free
 * {@link applyTemplate} helper, then attempts to `JSON.parse` the result: a
 * template that yields valid JSON (e.g. `{"n": {{input}}}`) returns the parsed
 * value, while anything else returns the raw rendered string. This lets a
 * workflow author either pluck a field (`{{input.name}}`) or assemble a small
 * JSON structure — without ever running arbitrary code.
 *
 * @module
 */
import { createElement } from 'react'
import type { WorkflowNodeDef, NodeConfig } from '@/lib/interfaces'
import { applyTemplate } from '@/lib/workflows/expr'

/** Per-instance config for a {@link TransformNodeDef}: the render template. */
export interface TransformConfig extends NodeConfig {
  template: string
}

/** Compute node: renders a `{{path}}` template over its input value. */
export const TransformNodeDef: WorkflowNodeDef<TransformConfig> = {
  type: 'transform',
  category: 'compute',
  label: 'Transform',
  icon: '🧮',
  ports: () => ({
    inputs: [{ name: 'input', label: 'Input', type: 'any' }],
    outputs: [{ name: 'output', label: 'Output', type: 'json' }],
  }),
  defaultConfig: () => ({ template: '{{input}}' }),
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
        'Template',
      ),
      createElement('textarea', {
        rows: 4,
        value: config.template,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange({ ...config, template: e.target.value }),
        className:
          'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600 resize-none',
      }),
      createElement(
        'p',
        { className: 'text-[11px] text-zinc-500' },
        'Use {{input}} or {{input.field}}',
      ),
    ),
  execute: async (ctx, config) => {
    const text = applyTemplate(config.template, { input: ctx.inputs.input })
    try {
      return { output: JSON.parse(text) }
    } catch {
      return { output: text }
    }
  },
}
