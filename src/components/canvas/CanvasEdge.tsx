// src/components/canvas/CanvasEdge.tsx
'use client'
import { type EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow'

export function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#7c6af7', strokeWidth: 1.5, opacity: 0.7 }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan text-[10px] text-violet-400 bg-[#12131e] px-1.5 py-0.5 rounded border border-violet-500/30"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
