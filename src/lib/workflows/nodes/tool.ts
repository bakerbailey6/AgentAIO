'use client'
/**
 * The `tool` node: invokes a single built-in tool with templated arguments.
 *
 * Resolves `config.toolName` in {@link TOOL_REGISTRY}, parses
 * `config.argsTemplate` as JSON (substituting `{{input}}` with the node's
 * `input` value first), and calls the tool's `execute` within the run's
 * permission scope. The tool's result is returned on the `result` output port.
 *
 * @module
 */
import { createElement, useState } from 'react'
import type { WorkflowNodeDef, NodeConfig } from '@/lib/interfaces'
import { TOOL_REGISTRY, listBuiltInTools } from '@/lib/tools/registry'

/** Per-instance config for a {@link ToolNodeDef}. */
export interface ToolNodeConfig extends NodeConfig {
  toolName?: string
  argsTemplate: string
}

function ToolConfigPanel({
  config,
  onChange,
}: {
  config: ToolNodeConfig
  onChange: (c: ToolNodeConfig) => void
}) {
  const [tools] = useState(() => listBuiltInTools())

  return createElement(
    'div',
    { className: 'space-y-4' },
    createElement(
      'div',
      { className: 'space-y-1.5' },
      createElement(
        'label',
        {
          className:
            'block text-[11px] font-medium text-zinc-500 uppercase tracking-wider',
        },
        'Tool',
      ),
      createElement(
        'select',
        {
          value: config.toolName ?? '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, toolName: e.target.value || undefined }),
          className:
            'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
        },
        createElement('option', { value: '' }, 'Select a tool…'),
        ...tools.map((t) =>
          createElement('option', { key: t.name, value: t.name }, t.name),
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
        'Arguments (JSON)',
      ),
      createElement('textarea', {
        rows: 4,
        value: config.argsTemplate,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange({ ...config, argsTemplate: e.target.value }),
        placeholder: '{}',
        className:
          'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 font-mono focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600 resize-none',
      }),
    ),
  )
}

/** Compute node: invokes a built-in tool with templated JSON args. */
export const ToolNodeDef: WorkflowNodeDef<ToolNodeConfig> = {
  type: 'tool',
  category: 'compute',
  label: 'Tool',
  icon: '🔧',
  ports: () => ({
    inputs: [{ name: 'input', label: 'Input', type: 'any' }],
    outputs: [{ name: 'result', label: 'Result', type: 'json' }],
  }),
  defaultConfig: () => ({ toolName: undefined, argsTemplate: '{}' }),
  ConfigPanel: ToolConfigPanel,
  execute: async (ctx, config) => {
    if (!config.toolName) throw new Error('tool node has no tool selected')
    const def = TOOL_REGISTRY.get(config.toolName)
    if (!def) throw new Error(`tool node references unknown tool ${config.toolName}`)

    const args = JSON.parse(
      config.argsTemplate.replaceAll('{{input}}', String(ctx.inputs.input ?? '')),
    )
    const result = await def.execute(args, {
      agentId: 'workflow',
      sessionId: ctx.runId,
      permissionScope: ctx.permissionScope,
    })

    return { result }
  },
}
