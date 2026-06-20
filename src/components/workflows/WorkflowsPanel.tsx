// src/components/workflows/WorkflowsPanel.tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WorkflowEditor } from '@/components/workflows/WorkflowEditor'
import { initDb, WorkflowRepository, type Db, type WorkflowRow } from '@/lib/storage'

export interface WorkflowsPanelProps {
  onClose: () => void
}

/** Format a unix-seconds timestamp as a short relative-ish "updated" label. */
function formatUpdated(seconds: number): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toLocaleString()
}

/**
 * Full-height right panel listing saved workflows. Mirrors `StorePanel`'s
 * container recipe (wider, to host the editor). Lists
 * {@link WorkflowRepository.findAll}, creates a new workflow, opens one in the
 * {@link WorkflowEditor}, or deletes one. When a workflow is open the editor
 * replaces the list full-bleed inside the panel.
 */
export function WorkflowsPanel({ onClose }: WorkflowsPanelProps): React.JSX.Element {
  const [rows, setRows] = useState<WorkflowRow[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const dbRef = useRef<Db | null>(null)

  const refetch = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const list = await new WorkflowRepository(db).findAll()
    setRows(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = await initDb()
      if (cancelled) return
      dbRef.current = db
      const list = await new WorkflowRepository(db).findAll()
      if (cancelled) return
      setRows(list)
    })().catch((e: unknown) => console.error('Failed to load workflows', e))
    return () => {
      cancelled = true
    }
  }, [])

  const handleNew = useCallback(async () => {
    const db = dbRef.current
    if (!db) return
    const id = await new WorkflowRepository(db).create({ name: 'Untitled workflow' })
    await refetch()
    setOpenId(id)
  }, [refetch])

  const handleDelete = useCallback(
    async (id: string) => {
      const db = dbRef.current
      if (!db) return
      await new WorkflowRepository(db).delete(id)
      await refetch()
    },
    [refetch],
  )

  // When a workflow is open, the editor takes over the whole panel.
  if (openId) {
    return (
      <div className="absolute inset-y-0 right-0 w-[640px] bg-[#0d0d0f] border-l border-white/[0.08] flex flex-col z-20 shadow-2xl shadow-black/40">
        <WorkflowEditor
          workflowId={openId}
          onBack={() => {
            setOpenId(null)
            void refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="absolute inset-y-0 right-0 w-[640px] bg-[#0d0d0f] border-l border-white/[0.08] flex flex-col z-20 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-zinc-200">Workflows</span>
        <div className="flex-1" />
        <button
          onClick={handleNew}
          className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-[12px] font-semibold text-black transition-colors"
        >
          New workflow
        </button>
        <button
          aria-label="Close workflows"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none"
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-[12px] leading-relaxed">
            No workflows yet.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(row.id)}
              className="group flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-zinc-200 truncate">{row.name}</div>
                {row.updatedAt ? (
                  <div className="text-[11px] text-zinc-600 truncate">
                    Updated {formatUpdated(row.updatedAt)}
                  </div>
                ) : null}
              </div>
              <button
                aria-label={`Delete ${row.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDelete(row.id)
                }}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-[12px]"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
