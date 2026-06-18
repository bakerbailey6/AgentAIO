// src/components/canvas/AgentCanvas.tsx
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { type AgentNodeData } from './AgentCardNode'
import { type GroupNodeData } from './GroupNode'
import { CanvasEdge } from './CanvasEdge'
import { saveAgentPosition, saveCanvasState, loadCanvasState } from '@/lib/canvas/persistence'
import { getNodeTypes } from '@/lib/canvas/node-registry'
import type { AgentRow } from '@/lib/storage'

const EDGE_TYPES = { custom: CanvasEdge }

const EDGE_OPTIONS = {
  style: { stroke: '#7c6af7', strokeWidth: 1.5, opacity: 0.7 },
  animated: true,
}

interface AgentCanvasProps {
  agents: AgentRow[]
  onOpenChat: (agentId: string) => void
}

export function AgentCanvas({ agents, onOpenChat }: AgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData | GroupNodeData>([])
  const [edges, , onEdgesChange] = useEdgesState([])
  const [loaded, setLoaded] = useState(false)
  const [savedViewport, setSavedViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })

  const nodeTypes = useMemo(() => getNodeTypes(), [])
  const initializedRef = useRef(false)

  useEffect(() => {
    loadCanvasState()
      .then((state) => {
        if (state) {
          setSavedViewport(state.viewport)
        }
      })
      .catch((e: unknown) => console.error('Failed to load canvas state', e))
      .finally(() => setLoaded(true))
  }, [])

  const agentNodes = useMemo<Node<AgentNodeData>[]>(() =>
    agents.map((row) => ({
      id: row.id,
      type: 'agentCard',
      position: { x: row.canvasX, y: row.canvasY },
      data: {
        label: row.name,
        agentId: row.id,
        name: row.name,
        icon: row.type === 'llm' ? '🤖' : row.type === 'coding-agent' ? '🧑‍💻' : '⚡',
        modelName: row.modelId ?? 'No model',
        toolCount: (row.toolIds ?? []).length,
        agentType: row.type,
        status: 'idle' as const,
        actions: [],
        onOpenChat: () => onOpenChat(row.id),
      },
    })), [agents, onOpenChat])

  useEffect(() => {
    if (!initializedRef.current) {
      // First load: set nodes with positions from DB
      setNodes(agentNodes)
      initializedRef.current = true
    } else {
      // Subsequent updates (e.g. new agent added): merge — add new nodes, update data on
      // existing ones, but don't move nodes the user may have dragged
      setNodes(prev => {
        const existingIds = new Set(prev.map(n => n.id))
        const newNodes = agentNodes.filter(n => !existingIds.has(n.id))
        const updatedPrev = prev.map(prevNode => {
          const updated = agentNodes.find(n => n.id === prevNode.id)
          if (!updated) return prevNode
          // Update data but preserve position
          return { ...prevNode, data: updated.data }
        })
        return [...updatedPrev, ...newNodes]
      })
    }
  }, [agentNodes, setNodes])

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'agentCard') {
      saveAgentPosition((node.data as AgentNodeData).agentId, node.position.x, node.position.y)
    }
  }, [])

  const handleMoveEnd = useCallback((_: MouseEvent | TouchEvent, viewport: Viewport) => {
    const groupNodes = nodes.filter((n) => n.type === 'group')
    saveCanvasState(viewport, groupNodes)
  }, [nodes])

  if (!loaded) return null

  return (
    <div className="w-full h-full bg-[#09090b]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={EDGE_OPTIONS}
        defaultViewport={savedViewport}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#27272a" gap={24} size={1} />
        <Controls className="[&>button]:bg-white/[0.06] [&>button]:border-white/[0.08] [&>button]:text-zinc-400 [&>button:hover]:bg-white/[0.10]" />
        <MiniMap
          style={{ background: '#09090b' }}
          nodeColor="#3f3f46"
          maskColor="rgba(9,9,11,0.8)"
        />
      </ReactFlow>
    </div>
  )
}
