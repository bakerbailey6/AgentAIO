// src/components/workflows/WorkflowEditor.tsx
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { WorkflowNodeCard, WORKFLOW_NODE_TYPE, type WorkflowNodeCardData } from './WorkflowNodeCard'
import { NodePalette } from './NodePalette'
import { NodeConfigRail } from './NodeConfigRail'
import { RunModal } from './RunModal'
import { normalizeGraph } from '@/lib/workflows/graph'
import { runWorkflow } from '@/lib/workflows/engine'
import { WORKFLOW_NODE_REGISTRY } from '@/lib/workflows/node-registry'
import { useWorkflowRun } from '@/hooks/useWorkflowRun'
import { WorkflowRepository, WorkflowRunRepository, initDb, type Db } from '@/lib/storage'

export interface WorkflowEditorProps {
  workflowId: string
  onBack: () => void
}

/**
 * The workflow integration canvas: a React Flow editor for one saved workflow.
 *
 * Loads the workflow row on mount, wires the node palette / config rail / run
 * modal, persists edits via {@link WorkflowRepository}, and executes the graph
 * through {@link runWorkflow} while reflecting live per-node status (from
 * {@link useWorkflowRun}) onto each card. Mirrors `AgentCanvas` for the RF setup.
 */
export function WorkflowEditor({ workflowId, onBack }: WorkflowEditorProps): React.JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNodeCardData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [runOpen, setRunOpen] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

  const dbRef = useRef<Db | null>(null)

  const nodeTypes = useMemo(() => ({ [WORKFLOW_NODE_TYPE]: WorkflowNodeCard }), [])

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = await initDb()
      if (cancelled) return
      dbRef.current = db
      const row = await new WorkflowRepository(db).findById(workflowId)
      if (cancelled || !row) return
      setName(row.name)
      setNodes(row.nodes as Node<WorkflowNodeCardData>[])
      setEdges(row.edges as Edge[])
    })().catch((e: unknown) => console.error('Failed to load workflow', e))
    return () => {
      cancelled = true
    }
  }, [workflowId, setNodes, setEdges])

  // --- React Flow handlers ------------------------------------------------
  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<WorkflowNodeCardData>) => setSelectedId(node.id),
    [],
  )

  // --- palette: append a fresh node --------------------------------------
  const handleAdd = useCallback(
    (type: string) => {
      const def = WORKFLOW_NODE_REGISTRY.get(type)!
      setNodes((ns) => [
        ...ns,
        {
          id: crypto.randomUUID(),
          type: WORKFLOW_NODE_TYPE,
          position: { x: 120, y: 80 + ns.length * 120 },
          data: { type, config: def.defaultConfig(), label: def.label } as WorkflowNodeCardData,
        },
      ])
    },
    [setNodes],
  )

  // --- config rail: write edits back into node data ----------------------
  const selected = nodes.find((n) => n.id === selectedId) ?? null

  const handleConfigChange = useCallback(
    (cfg: WorkflowNodeCardData['config']) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, config: cfg } } : n)),
      )
    },
    [selectedId, setNodes],
  )

  // --- save ---------------------------------------------------------------
  const handleSave = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    await new WorkflowRepository(db).update(workflowId, { nodes, edges })
  }, [workflowId, nodes, edges])

  // --- run ----------------------------------------------------------------
  const handleRun = useCallback(
    async (input: unknown) => {
      const db = dbRef.current
      if (!db) return
      const graph = normalizeGraph(
        nodes.map((n) => ({ id: n.id, data: { type: n.data.type, config: n.data.config } })),
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      )
      const runId = await new WorkflowRunRepository(db).create({ workflowId, input })
      setActiveRunId(runId)
      const result = await runWorkflow(graph, input, {
        runId,
        permissionScope: { allowedPaths: [], allowedDomains: [], shellEnabled: false },
        registry: WORKFLOW_NODE_REGISTRY,
      })
      await new WorkflowRunRepository(db).finish(runId, {
        status: result.status,
        result: result.output,
        nodeStates: result.nodeStates,
      })
      setRunOpen(false)
    },
    [workflowId, nodes, edges],
  )

  // --- live per-node status ----------------------------------------------
  const run = useWorkflowRun(activeRunId)
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => ({ ...n, data: { ...n.data, runStatus: run.nodeStatus[n.id] } })),
    )
  }, [run.nodeStatus, setNodes])

  // --- layout -------------------------------------------------------------
  return (
    <div className="flex h-full w-full flex-col bg-[#09090b] text-zinc-100">
      {/* top bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[#0d0d0f] px-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.08]"
        >
          ← Back
        </button>
        <span className="flex-1 truncate text-[13px] font-semibold text-zinc-100">{name}</span>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.08]"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setRunOpen(true)}
          className="rounded-md bg-white px-3 py-1 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          Run
        </button>
      </div>

      {/* body: palette | canvas | config rail */}
      <div className="flex min-h-0 flex-1">
        <NodePalette onAdd={handleAdd} />

        <div className="relative flex-1 bg-[#09090b]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#27272a" gap={24} size={1} />
            <Controls className="[&>button]:bg-white/[0.06] [&>button]:border-white/[0.08] [&>button]:text-zinc-400 [&>button:hover]:bg-white/[0.10]" />
          </ReactFlow>
        </div>

        <NodeConfigRail
          node={selected ? { id: selected.id, type: selected.data.type, config: selected.data.config } : null}
          onChange={handleConfigChange}
          onClose={() => setSelectedId(null)}
        />
      </div>

      <RunModal open={runOpen} onClose={() => setRunOpen(false)} onRun={handleRun} />
    </div>
  )
}
