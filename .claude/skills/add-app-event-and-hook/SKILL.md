---
name: add-app-event-and-hook
description: Use when adding cross-cutting pub/sub plumbing to Agent Command Center — a new event type on the in-process event bus plus a React hook that derives UI state from it (e.g. agent status, cost, action feed updates). Covers the AppEvent union registration, the emit contract, the hook subscribe/cleanup shape, and the bus-mock test.
---

# Add an app event + consumer hook

## Overview

The event bus (`src/lib/event-bus.ts`, singleton via `getEventBus()`) is a typed in-process pub/sub
that decouples producers (agent runtimes, canvas) from consumers (React UI, via hooks). Events are the
`AppEvent` discriminated union in `src/lib/interfaces/event-bus.ts`. Adding a new event + hook is a
fixed template — the value here is the **hook lifecycle details** that are easy to get subtly wrong and
the **silent no-op** failure mode of a mistyped event type.

## When to use

- Adding a new event producers emit and the UI reacts to.
- Symptoms: "broadcast X to the UI", "a hook that updates when Y happens", "live counts/feed for Z".

## Get these right (why this skill exists)

- **Hook cleanup + scoping.** `getEventBus().on(...)` returns the unsubscribe; the `useEffect`
  **must `return` it** or listeners leak. Per-entity hooks **filter by id inside the handler**
  (`if (event.agentId !== agentId) return`) — the bus has one channel per event *type*, not per
  entity — and **reset local state at the top of the effect** so an id change starts clean. (Mirror
  `src/hooks/useAgentActions.ts`.)
- **Silent no-op.** `emit` is `listeners.get(event.type)?.forEach(...)` — an unknown/mistyped `type`
  matches nothing and throws no error. A typo in the `type` literal = an event no hook ever receives.
- **`AgentEvent` ≠ `AppEvent`.** `AgentEvent` (in `src/lib/interfaces/agent-provider.ts`) is what
  `AgentProvider.run` yields, with an untyped `payload`. `src/components/chat/ChatPanel.tsx` is the
  translation layer that maps those into typed `AppEvent`s. Don't conflate the two unions.

## Recipe

1. **Define the event interface** in `src/lib/interfaces/event-bus.ts`: a namespaced string-literal
   `type` (`'agent:cost-updated'`, `'canvas:…'`) + a `timestamp: number` + your payload fields. Import
   any referenced types (e.g. `AgentStatus`) from `./agent-provider`.
   ```ts
   /** An agent's running cost estimate changed. */
   export interface AgentCostUpdatedEvent {
     type: 'agent:cost-updated'
     agentId: string
     costEstimate: number
     timestamp: number
   }
   ```
2. **Add it to the `AppEvent` union** in the same file. **This is the only registration step** —
   `event-bus.ts` and the barrel (`src/lib/interfaces/index.ts`, which does `export type *`) need no
   change.
3. **Emit from the producer** (e.g. `ChatPanel.tsx`, `AgentCardNode.tsx`):
   `getEventBus().emit({ type: 'agent:cost-updated', agentId, costEstimate, timestamp: Date.now() })`.
4. **Create the hook** `src/hooks/use<Thing>.ts`:
   ```ts
   'use client'
   import { useState, useEffect } from 'react'
   import { getEventBus } from '@/lib/event-bus'
   import type { AgentCostUpdatedEvent } from '@/lib/interfaces'

   export function useAgentCost(agentId: string): number {
     const [cost, setCost] = useState(0)
     useEffect(() => {
       setCost(0) // reset when agentId changes
       const unsub = getEventBus().on('agent:cost-updated', (e: AgentCostUpdatedEvent) => {
         if (e.agentId !== agentId) return
         setCost(e.costEstimate)
       })
       return unsub // cleanup
     }, [agentId])
     return cost
   }
   ```
   Put the scoping key (`agentId`, `maxItems`) in the dependency array. For aggregations across agents,
   hold the map in a `useRef` and recompute (`useAgentCounts.ts`). Multi-event hooks subscribe to each
   type and return a combined cleanup that calls every unsub (`useApprovals.ts`).
5. **Test** the hook (see Testing). Optionally add a round-trip test with a real `createEventBus()` in
   `src/lib/__tests__/event-bus.test.ts`.
6. **Verify:** `npm test`.

## Common mistakes

| Mistake | Consequence |
|---|---|
| `useEffect` doesn't `return` the unsub | Listener leaks across mounts/tests |
| No state reset on id change | Stale value briefly shown after switching agents |
| Mistyped `type` literal | Event silently matches no listener — no error |
| Forgot `timestamp: Date.now()` | Inconsistent event shape; some consumers rely on it |
| Conflated `AgentEvent` with `AppEvent` | Wrong union; handler never fires |
| Multi-event hook returns only one unsub | The other subscription leaks |

## Testing

Vitest + `renderHook`. Mock the bus at module level and capture the handler:
```ts
let handler: ((e: AgentCostUpdatedEvent) => void) | undefined
const mockBus = { on: vi.fn((_t, h) => { handler = h; return vi.fn() }), off: vi.fn(), emit: vi.fn() }
vi.mock('@/lib/event-bus', () => ({ getEventBus: vi.fn(() => mockBus) }))
```
Then drive it synchronously: `act(() => handler?.({ type: 'agent:cost-updated', agentId: 'a', costEstimate: 5, timestamp: 1 }))` and assert `result.current`. `beforeEach` clears the captured handler + `vi.clearAllMocks()`. For multi-event hooks use a `Record<type, handler>` and assert both unsubs fire on unmount. Template: `src/hooks/__tests__/useApprovals.test.ts`.
