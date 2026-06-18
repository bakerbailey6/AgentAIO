// src/components/canvas/AgentCanvas.tsx
'use client'
import { useCallback, useEffect } from 'react'
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
import { AgentCardNode, type AgentNodeData } from './AgentCardNode'
import { GroupNode, type GroupNodeData } from './GroupNode'
import { saveAgentPosition, saveCanvasState, loadCanvasState } from '@/lib/canvas/persistence'

const NODE_TYPES = {
  agentCard: AgentCardNode,
  group: GroupNode,
}

const EDGE_OPTIONS = {
  style: { stroke: '#7c6af7', strokeWidth: 1.5, opacity: 0.7 },
  animated: true,
}

export function AgentCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData | GroupNodeData>([])
  const [edges, , onEdgesChange] = useEdgesState<Edge[]>([])

  useEffect(() => {
    loadCanvasState().then((state) => {
      if (state) {
        // restore viewport handled by defaultViewport prop
      }
    })
  }, [])

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'agentCard') {
      saveAgentPosition((node.data as AgentNodeData).agentId, node.position.x, node.position.y)
    }
  }, [])

  const handleMoveEnd = useCallback((_: MouseEvent | TouchEvent, viewport: Viewport) => {
    saveCanvasState(viewport, [])
  }, [])

  return (
    <div className="w-full h-full bg-[#080910]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={EDGE_OPTIONS}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        fitView
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
