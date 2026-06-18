'use client'
import { useEffect, useRef } from 'react'

export interface ActionEntry {
  id: string
  text: string
  type: 'info' | 'warning' | 'success' | 'error'
  timestamp: number
}

const COLOR: Record<ActionEntry['type'], string> = {
  info: 'text-neutral-500',
  warning: 'text-red-400',
  success: 'text-neutral-500',
  error: 'text-red-400',
}

const PREFIX: Record<ActionEntry['type'], string> = {
  info: '⟳ ',
  warning: '⚠  ',
  success: '✓  ',
  error: '✕  ',
}

interface ActionFeedProps {
  actions: ActionEntry[]
  activeAction?: ActionEntry
}

export function ActionFeed({ actions, activeAction }: ActionFeedProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollTo?.({ top: 0 })
  }, [actions.length])

  return (
    <div ref={ref} className="flex flex-col-reverse gap-0.5 overflow-hidden max-h-[72px]">
      {activeAction && (
        <div className="px-2 py-1 rounded bg-[#0e1a12] border border-green-500/20 text-[11px] text-green-400 truncate">
          {PREFIX.info}{activeAction.text}
        </div>
      )}
      {actions.slice(0, 4).map((a) => (
        <div key={a.id} className={`px-2 py-0.5 rounded bg-[#0d0e18] text-[10px] ${COLOR[a.type]} truncate`}>
          {PREFIX[a.type]}{a.text}
        </div>
      ))}
    </div>
  )
}
