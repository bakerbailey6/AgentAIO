import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { WorkflowNodeStatusEvent, WorkflowRunFinishedEvent } from '@/lib/interfaces'

/** Live state for a single workflow run, derived from the `workflow:*` bus events. */
export interface WorkflowRunState {
  runId: string | null
  status: 'idle' | 'running' | 'done' | 'error'
  nodeStatus: Record<string, 'pending' | 'running' | 'done' | 'error'>
  result: unknown
}

/** Build the reset state for a given run id (idle when there is no run). */
function initialState(runId: string | null): WorkflowRunState {
  return {
    runId,
    status: runId ? 'running' : 'idle',
    nodeStatus: {},
    result: undefined,
  }
}

/**
 * Track the live state of a workflow run for editor overlays.
 *
 * Subscribes to `workflow:node-status` and `workflow:run-finished`, ignoring any
 * event whose `runId` does not match the hook's `runId`. Per-node statuses
 * accumulate in `nodeStatus`; `workflow:run-finished` sets the terminal
 * `status` + `result`. When `runId` changes the rolling state is reset (running
 * for a real id, idle for `null`).
 */
export function useWorkflowRun(runId: string | null): WorkflowRunState {
  const [state, setState] = useState<WorkflowRunState>(() => initialState(runId))

  // Reset whenever the watched run changes (including switching back to null).
  // Done during render via the React "adjust state when a prop changes" pattern
  // (compare against the previous `runId` held in state) so the returned state is
  // already fresh on the same commit — no setState-inside-effect cascade.
  const [trackedRunId, setTrackedRunId] = useState(runId)
  if (trackedRunId !== runId) {
    setTrackedRunId(runId)
    setState(initialState(runId))
  }

  useEffect(() => {
    if (!runId) return

    const bus = getEventBus()

    const unsubNode = bus.on('workflow:node-status', (event: WorkflowNodeStatusEvent) => {
      if (event.runId !== runId) return
      setState((prev) => ({
        ...prev,
        status: prev.status === 'idle' ? 'running' : prev.status,
        nodeStatus: { ...prev.nodeStatus, [event.nodeId]: event.status },
      }))
    })

    const unsubFinished = bus.on('workflow:run-finished', (event: WorkflowRunFinishedEvent) => {
      if (event.runId !== runId) return
      setState((prev) => ({
        ...prev,
        status: event.status,
        result: event.result,
      }))
    })

    return () => {
      unsubNode()
      unsubFinished()
    }
  }, [runId])

  return state
}
