'use client'
/**
 * The `agent` node: runs a configured agent and streams its text output.
 *
 * Resolves `config.agentId` to its persisted row, picks the runtime provider
 * from {@link AGENT_REGISTRY} via {@link resolveAgentRuntimeType}, opens a fresh
 * session, then renders `config.promptTemplate` (substituting `{{input}}` with
 * the node's `input` value) and runs the provider, accumulating the streamed
 * `text-delta`s. The accumulated text is returned on both the `text` and
 * `result` output ports.
 *
 * @module
 */
import { createElement, useEffect, useState } from 'react'
import type { WorkflowNodeDef, NodeConfig, AgentEvent } from '@/lib/interfaces'
import { initDb, AgentRepository } from '@/lib/storage'
import type { AgentRow } from '@/lib/storage'
import { SessionRepository } from '@/lib/storage'
import { AGENT_REGISTRY, resolveAgentRuntimeType } from '@/lib/agents/registry'

/** Per-instance config for an {@link AgentNodeDef}. */
export interface AgentNodeConfig extends NodeConfig {
  agentId?: string
  promptTemplate: string
}

function AgentConfigPanel({
  config,
  onChange,
}: {
  config: AgentNodeConfig
  onChange: (c: AgentNodeConfig) => void
}) {
  const [agents, setAgents] = useState<AgentRow[]>([])

  useEffect(() => {
    initDb()
      .then((db) => new AgentRepository(db).findAll())
      .then(setAgents)
      .catch(console.error)
  }, [])

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
        'Agent',
      ),
      createElement(
        'select',
        {
          value: config.agentId ?? '',
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...config, agentId: e.target.value || undefined }),
          className:
            'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50',
        },
        createElement('option', { value: '' }, 'Select an agent…'),
        ...agents.map((a) =>
          createElement('option', { key: a.id, value: a.id }, a.name),
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
        'Prompt',
      ),
      createElement('textarea', {
        rows: 4,
        value: config.promptTemplate,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange({ ...config, promptTemplate: e.target.value }),
        placeholder: '{{input}}',
        className:
          'w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600 resize-none',
      }),
    ),
  )
}

/** Compute node: runs a configured agent over the node's input. */
export const AgentNodeDef: WorkflowNodeDef<AgentNodeConfig> = {
  type: 'agent',
  category: 'compute',
  label: 'Agent',
  icon: '🤖',
  ports: () => ({
    inputs: [{ name: 'input', label: 'Input', type: 'any' }],
    outputs: [
      { name: 'text', label: 'Text', type: 'text' },
      { name: 'result', label: 'Result', type: 'json' },
    ],
  }),
  defaultConfig: () => ({ agentId: undefined, promptTemplate: '{{input}}' }),
  ConfigPanel: AgentConfigPanel,
  execute: async (ctx, config) => {
    if (!config.agentId) throw new Error('agent node has no agent selected')
    const db = await initDb()
    const agentRow = await new AgentRepository(db).findById(config.agentId)
    if (!agentRow) throw new Error(`agent node references unknown agent ${config.agentId}`)
    const provider = AGENT_REGISTRY.get(resolveAgentRuntimeType(agentRow.type))
    if (!provider) throw new Error(`no runtime registered for agent type ${agentRow.type}`)

    const sessionId = await new SessionRepository(db).create({
      agentId: config.agentId,
      messages: [],
      tokenCount: 0,
      costEstimate: 0,
    })

    const prompt = config.promptTemplate.replaceAll(
      '{{input}}',
      String(ctx.inputs.input ?? ''),
    )

    ctx.report('running')
    let accumulated = ''
    for await (const event of provider.run(
      { id: sessionId, agentId: config.agentId, permissionScope: ctx.permissionScope },
      prompt,
    )) {
      const e = event as AgentEvent
      if (e.type === 'text-delta') {
        accumulated += (e.payload as { delta?: string }).delta ?? ''
      }
    }
    ctx.report('done')

    return { text: accumulated, result: accumulated }
  },
}
