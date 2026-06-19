// src/components/workflows/WorkflowRunHistory.tsx
'use client'
import { useEffect, useState } from 'react'
import { initDb, WorkflowRunRepository, type WorkflowRunRow } from '@/lib/storage'

export interface WorkflowRunHistoryProps {
  workflowId: string
  onRerun: (input: unknown) => void
  /** Bump to force a reload (e.g. after a run finishes). */
  refreshKey?: number
}

/** Status → badge class recipe (hand-rolled zinc/indigo palette). */
const STATUS_BADGE: Record<WorkflowRunRow['status'], string> = {
  done: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
  running: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

/** Format a unix-seconds timestamp as a locale date/time string. */
function formatStarted(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString()
}

/**
 * Run-history view over `workflow_runs` for a single workflow. On mount and
 * whenever `workflowId`/`refreshKey` change, loads the runs (newest-first from
 * the repository) and renders one row each with a status badge, the started
 * time, a truncated `result` preview, and a **Re-run** button that replays the
 * run's captured `input`. Empty list → muted "No runs yet."
 */
export function WorkflowRunHistory({
  workflowId,
  onRerun,
  refreshKey,
}: WorkflowRunHistoryProps): React.JSX.Element {
  const [runs, setRuns] = useState<WorkflowRunRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = await initDb()
      if (cancelled) return
      const list = await new WorkflowRunRepository(db).findByWorkflowId(workflowId)
      if (cancelled) return
      setRuns(list)
    })().catch(() => {
      // Web mode has no DB — render an empty list rather than blowing up.
      if (!cancelled) setRuns([])
    })
    return () => {
      cancelled = true
    }
  }, [workflowId, refreshKey])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-zinc-200">Run history</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-[12px] leading-relaxed">
            No runs yet.
          </div>
        ) : (
          runs.map((run) => (
            <div
              key={run.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.06]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[run.status]}`}
                  >
                    {run.status}
                  </span>
                  <span className="text-[11px] text-zinc-600 truncate">
                    {formatStarted(run.startedAt)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500 font-mono truncate">
                  {JSON.stringify(run.result)}
                </div>
              </div>
              <button
                onClick={() => onRerun(run.input)}
                className="shrink-0 px-2.5 py-1 rounded-lg border border-white/[0.08] text-[11px] font-medium text-zinc-300 hover:bg-white/[0.04] hover:border-indigo-500/50 transition-colors"
              >
                Re-run
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
