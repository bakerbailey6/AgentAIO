// src/components/canvas/AgentCanvas.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { type AgentNodeData } from './AgentCardNode'
import { type GroupNodeData } from './GroupNode'
import { CanvasEdge } from './CanvasEdge'
import { saveAgentPosition, saveCanvasState, loadCanvasState } from '@/lib/canvas/persistence'
import { getNodeTypes } from '@/lib/canvas/node-registry'

const EDGE_TYPES = { custom: CanvasEdge }

const EDGE_OPTIONS = {
  style: { stroke: '#7c6af7', strokeWidth: 1.5, opacity: 0.7 },
  animated: true,
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

export function AgentCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData | GroupNodeData>([])
  const [edges, , onEdgesChange] = useEdgesState<Edge>([])
  const [defaultViewport, setDefaultViewport] = useState<Viewport>(DEFAULT_VIEWPORT)

  useEffect(() => {
    loadCanvasState()
      .then((state) => {
        if (state) {
          setDefaultViewport(state.viewport)
        }
      })
      .catch((e: unknown) => console.error('Failed to load canvas state', e))
  }, [])

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'agentCard') {
      saveAgentPosition((node.data as AgentNodeData).agentId, node.position.x, node.position.y)
    }
  }, [])

  const handleMoveEnd = useCallback((_: MouseEvent | TouchEvent, viewport: Viewport) => {
    const groupNodes = nodes.filter((n) => n.type === 'group')
    saveCanvasState(viewport, groupNodes)
  }, [nodes])

  return (
    <div className="w-full h-full bg-[#080910]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={getNodeTypes()}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={EDGE_OPTIONS}
        defaultViewport={defaultViewport}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e1f2e" gap={24} size={0.8} />
        <Controls className="[&>button]:bg-[#1e2030] [&>button]:border-[#333] [&>button]:text-neutral-400" />
        <MiniMap
          className="bg-[#0a0b14] border border-[#1e2030] rounded-lg"
          nodeColor={(n) => n.type === 'agentCard' ? '#7c6af7' : '#333'}
          maskColor="rgba(8,9,16,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
