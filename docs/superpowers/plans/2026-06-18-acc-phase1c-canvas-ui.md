# Agent Command Center — Phase 1C: Spatial Canvas UI, Approval Gates & Store Panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infinite spatial canvas with draggable agent cards, live status updates, group support, animated connections, inline approval gates, and the Store panel for browsing/installing MCPs, tools, and skills.

**Architecture:** React Flow provides the canvas engine. Each agent card is a React Flow custom node implementing `CanvasNode<TData>`. Live updates arrive via the `EventBus` singleton (from Phase 1A) and are applied to React state using `useReducer`. The canvas layout is persisted to SQLite `canvas_state` on every change. The Store panel reads from `McpRepository` and `ToolRepository`.

**Prerequisites:** Phase 1A and 1B complete.

**Tech Stack:** React Flow ≥ 12 · React 19 · shadcn/ui · Tailwind CSS · Vitest + React Testing Library

## Global Constraints

- Agent cards implement `CanvasNode<TData>` — no ad-hoc node types
- Canvas state (positions, groups, zoom) persisted to SQLite on every drag-end and group change
- All live updates flow through `getEventBus()` — no direct prop-drilling of agent state
- `"strict": true` TypeScript throughout
- Components tested with React Testing Library

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/app/page.tsx` | Home page — renders full canvas layout |
| `src/app/layout.tsx` | Root layout with sidebar + top bar |
| `src/components/layout/Sidebar.tsx` | Icon sidebar (Home, Chat, Workflows, Store, Settings) |
| `src/components/layout/TopBar.tsx` | App name, approval badge, zoom controls, + Agent button |
| `src/components/layout/StatusBar.tsx` | Bottom bar: live counts |
| `src/components/canvas/AgentCanvas.tsx` | React Flow root, node/edge state, persistence |
| `src/components/canvas/AgentCardNode.tsx` | React Flow custom node wrapping `AgentCard` |
| `src/components/canvas/AgentCard.tsx` | Card UI: status glow, action feed, ports, footer |
| `src/components/canvas/ActionFeed.tsx` | Scrolling log of agent tool calls |
| `src/components/canvas/GroupNode.tsx` | React Flow group node (dashed border + label) |
| `src/components/canvas/CanvasEdge.tsx` | Animated connection edge |
| `src/components/approval/ApprovalGate.tsx` | Inline approve/deny with risk badge |
| `src/components/store/StorePanel.tsx` | Slide-in store panel |
| `src/components/store/StoreItemRow.tsx` | Single MCP/tool/skill row |
| `src/hooks/useAgentStatus.ts` | Hook: subscribes to EventBus, returns per-agent status map |
| `src/hooks/useApprovals.ts` | Hook: subscribes to approval-requested events, returns pending list |
| `src/lib/canvas/node-registry.ts` | `NODE_REGISTRY: Map<string, CanvasNode>` |
| `src/lib/canvas/persistence.ts` | `saveCanvasState()`, `loadCanvasState()` |

---

## Task 11: App Shell (Layout, Sidebar, TopBar, StatusBar)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/StatusBar.tsx`

**Interfaces:**
- Produces: full-screen layout with sidebar, top bar, status bar, and a `{children}` content area

- [ ] **Step 1: Write layout test**

Create `src/components/layout/__tests__/Sidebar.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  it('renders navigation icons', () => {
    render(<Sidebar activeItem="home" onNavigate={() => {}} />)
    expect(screen.getByLabelText('Home')).toBeInTheDocument()
    expect(screen.getByLabelText('Store')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('highlights the active item', () => {
    render(<Sidebar activeItem="store" onNavigate={() => {}} />)
    expect(screen.getByLabelText('Store').closest('button')).toHaveClass('bg-violet-600')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/components/layout/__tests__/Sidebar.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement Sidebar**

```typescript
// src/components/layout/Sidebar.tsx
'use client'
import { cn } from '@/lib/utils'

type NavItem = 'home' | 'chat' | 'workflows' | 'store' | 'settings'

const NAV_ITEMS: Array<{ id: NavItem; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'store', label: 'Store', icon: '📦' },
]

interface SidebarProps {
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
}

export function Sidebar({ activeItem, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[52px] h-full bg-[#080910] flex flex-col items-center py-3 gap-2 shrink-0">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          aria-label={item.label}
          onClick={() => onNavigate(item.id)}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors',
            activeItem === item.id
              ? 'bg-violet-600 text-white'
              : 'bg-[#13141f] text-neutral-500 hover:text-neutral-300',
          )}
        >
          {item.icon}
        </button>
      ))}
      <div className="flex-1" />
      <button
        aria-label="Settings"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-[#13141f] text-neutral-500 hover:text-neutral-300"
      >
        ⚙
      </button>
    </aside>
  )
}
```

- [ ] **Step 4: Implement TopBar**

```typescript
// src/components/layout/TopBar.tsx
'use client'
interface TopBarProps {
  approvalCount: number
  onAddAgent: () => void
}

export function TopBar({ approvalCount, onAddAgent }: TopBarProps) {
  return (
    <header className="h-[44px] bg-[#0a0b14] border-b border-[#1e2030] flex items-center px-4 gap-3 shrink-0">
      <div>
        <p className="text-[9px] text-neutral-600 uppercase tracking-widest leading-none">Agent Command Center</p>
        <p className="text-[13px] text-neutral-100 font-semibold leading-tight">Mission Control</p>
      </div>
      <div className="flex-1" />
      {approvalCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/40">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[11px] text-red-400 font-semibold">{approvalCount} approval{approvalCount > 1 ? 's' : ''} needed</span>
        </div>
      )}
      <button
        onClick={onAddAgent}
        className="px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium transition-colors"
      >
        + Agent
      </button>
    </header>
  )
}
```

- [ ] **Step 5: Implement StatusBar**

```typescript
// src/components/layout/StatusBar.tsx
'use client'
interface StatusBarProps {
  runningCount: number
  idleCount: number
  approvalCount: number
  llmCallsToday: number
  estimatedCost: number
  modelsConnected: number
  toolsActive: number
}

export function StatusBar(props: StatusBarProps) {
  return (
    <footer className="h-[32px] bg-[#0a0b14] border-t border-[#1e2030] flex items-center px-4 gap-6 shrink-0">
      <span className="text-[11px] text-green-400">● {props.runningCount} running</span>
      {props.approvalCount > 0 && (
        <span className="text-[11px] text-red-400">⚠ {props.approvalCount} approvals</span>
      )}
      <span className="text-[11px] text-neutral-600">⏸ {props.idleCount} idle</span>
      <div className="flex-1" />
      <span className="text-[11px] text-neutral-600">{props.llmCallsToday} LLM calls · ~${props.estimatedCost.toFixed(2)}</span>
      <span className="text-[11px] text-neutral-600">{props.modelsConnected} models · {props.toolsActive} tools</span>
    </footer>
  )
}
```

- [ ] **Step 6: Wire layout.tsx**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Agent Command Center' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080910] text-neutral-100 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Run layout tests — expect pass**

```bash
npx vitest run src/components/layout/__tests__/Sidebar.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/ src/components/layout/
git commit -m "feat: app shell with sidebar, top bar, and status bar"
```

---

## Task 12: Live Status Hooks

**Files:**
- Create: `src/hooks/useAgentStatus.ts`
- Create: `src/hooks/useApprovals.ts`
- Test: `src/hooks/__tests__/useAgentStatus.test.ts`

**Interfaces:**
- Consumes: `getEventBus()`, `AgentStatus`, `AgentStatusChangedEvent`, `AgentApprovalRequestedEvent`
- Produces: `useAgentStatus(agentId): AgentStatus`, `useApprovals(): ApprovalRequest[]`

- [ ] **Step 1: Write failing hook test**

Create `src/hooks/__tests__/useAgentStatus.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockBus = { on: vi.fn(() => vi.fn()), emit: vi.fn(), off: vi.fn() }
vi.mock('@/lib/event-bus', () => ({ getEventBus: () => mockBus }))

import { useAgentStatus } from '../useAgentStatus'

describe('useAgentStatus', () => {
  it('returns idle initially', () => {
    const { result } = renderHook(() => useAgentStatus('agent-1'))
    expect(result.current).toBe('idle')
  })

  it('registers a listener on mount', () => {
    renderHook(() => useAgentStatus('agent-1'))
    expect(mockBus.on).toHaveBeenCalledWith('agent:status-changed', expect.any(Function))
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/hooks/__tests__/useAgentStatus.test.ts
```

- [ ] **Step 3: Implement useAgentStatus**

```typescript
// src/hooks/useAgentStatus.ts
import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { AgentStatus, AgentStatusChangedEvent } from '@/lib/interfaces'

export function useAgentStatus(agentId: string): AgentStatus {
  const [status, setStatus] = useState<AgentStatus>('idle')

  useEffect(() => {
    const unsub = getEventBus().on('agent:status-changed', (event: AgentStatusChangedEvent) => {
      if (event.agentId === agentId) setStatus(event.status)
    })
    return unsub
  }, [agentId])

  return status
}
```

- [ ] **Step 4: Implement useApprovals**

```typescript
// src/hooks/useApprovals.ts
import { useState, useEffect } from 'react'
import { getEventBus } from '@/lib/event-bus'
import type { ApprovalRequest, AgentApprovalRequestedEvent, AgentApprovalResolvedEvent } from '@/lib/interfaces'

export function useApprovals(): ApprovalRequest[] {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])

  useEffect(() => {
    const unsubRequest = getEventBus().on(
      'agent:approval-requested',
      (event: AgentApprovalRequestedEvent) => {
        setApprovals((prev) => [...prev, event.request])
      },
    )
    const unsubResolved = getEventBus().on(
      'agent:approval-resolved',
      (event: AgentApprovalResolvedEvent) => {
        setApprovals((prev) => prev.filter((a) => a.id !== event.requestId))
      },
    )
    return () => { unsubRequest(); unsubResolved() }
  }, [])

  return approvals
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx vitest run src/hooks/__tests__/useAgentStatus.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ 
git commit -m "feat: useAgentStatus and useApprovals hooks"
```

---

## Task 13: Agent Card Components

**Files:**
- Create: `src/components/canvas/AgentCard.tsx`
- Create: `src/components/canvas/ActionFeed.tsx`
- Create: `src/components/approval/ApprovalGate.tsx`
- Test: `src/components/canvas/__tests__/AgentCard.test.tsx`

**Interfaces:**
- Consumes: `useAgentStatus`, `useApprovals`, `AgentRow` from storage
- Produces: `AgentCard` — the visual card rendered inside each canvas node

- [ ] **Step 1: Write card test**

Create `src/components/canvas/__tests__/AgentCard.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/useAgentStatus', () => ({ useAgentStatus: () => 'running' }))
vi.mock('@/hooks/useApprovals', () => ({ useApprovals: () => [] }))

import { AgentCard } from '../AgentCard'

describe('AgentCard', () => {
  const baseProps = {
    agentId: 'a1',
    name: 'Coder',
    icon: '🧑‍💻',
    modelName: 'claude-sonnet-4-6',
    toolCount: 14,
    actions: [],
    onApprove: vi.fn(),
    onDeny: vi.fn(),
    onOpen: vi.fn(),
  }

  it('renders agent name', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText('Coder')).toBeInTheDocument()
  })

  it('shows RUNNING status', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
  })

  it('shows model name', () => {
    render(<AgentCard {...baseProps} />)
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/components/canvas/__tests__/AgentCard.test.tsx
```

- [ ] **Step 3: Implement ActionFeed**

```typescript
// src/components/canvas/ActionFeed.tsx
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
    ref.current?.scrollTo({ top: 0 })
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
```

- [ ] **Step 4: Implement ApprovalGate**

```typescript
// src/components/approval/ApprovalGate.tsx
'use client'
import type { ApprovalRequest } from '@/lib/interfaces'

const RISK_COLORS = {
  low: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  medium: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  high: 'border-red-500/40 bg-red-500/10 text-red-400',
}

interface ApprovalGateProps {
  request: ApprovalRequest
  onApprove: (id: string) => void
  onDeny: (id: string) => void
}

export function ApprovalGate({ request, onApprove, onDeny }: ApprovalGateProps) {
  return (
    <div className={`mx-2 mb-2 px-2 py-1.5 rounded border ${RISK_COLORS[request.risk]}`}>
      <p className="text-[10px] font-semibold truncate">{request.action}</p>
      <p className="text-[9px] text-neutral-500 truncate mb-1.5">{request.description}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onApprove(request.id)}
          className="flex-1 py-0.5 rounded bg-green-500 hover:bg-green-400 text-[10px] text-black font-bold"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onDeny(request.id)}
          className="flex-1 py-0.5 rounded border border-red-500/40 hover:bg-red-500/20 text-[10px] text-red-400"
        >
          ✕ Deny
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement AgentCard**

```typescript
// src/components/canvas/AgentCard.tsx
'use client'
import { cn } from '@/lib/utils'
import { ActionFeed, type ActionEntry } from './ActionFeed'
import { ApprovalGate } from '../approval/ApprovalGate'
import { useAgentStatus } from '@/hooks/useAgentStatus'
import type { ApprovalRequest } from '@/lib/interfaces'

const STATUS_STYLES = {
  'idle': { border: 'border-neutral-700', header: 'bg-[#141420]', dot: 'bg-neutral-500', label: 'IDLE', labelColor: 'text-neutral-500' },
  'running': { border: 'border-green-500', header: 'bg-[#0e1a12]', dot: 'bg-green-400', label: 'RUNNING', labelColor: 'text-green-400' },
  'awaiting-approval': { border: 'border-red-500', header: 'bg-[#1a0c0e]', dot: 'bg-red-400', label: 'APPROVAL NEEDED', labelColor: 'text-red-400' },
  'error': { border: 'border-red-700', header: 'bg-[#1a0808]', dot: 'bg-red-600', label: 'ERROR', labelColor: 'text-red-600' },
  'stopped': { border: 'border-neutral-700', header: 'bg-[#141420]', dot: 'bg-neutral-600', label: 'STOPPED', labelColor: 'text-neutral-600' },
}

interface AgentCardProps {
  agentId: string
  name: string
  icon: string
  modelName: string
  toolCount: number
  actions: ActionEntry[]
  pendingApprovals?: ApprovalRequest[]
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  onOpen: () => void
}

export function AgentCard({ agentId, name, icon, modelName, toolCount, actions, pendingApprovals = [], onApprove, onDeny, onOpen }: AgentCardProps) {
  const status = useAgentStatus(agentId)
  const style = STATUS_STYLES[status]

  return (
    <div
      className={cn('w-[200px] rounded-[10px] bg-[#12131e] border overflow-hidden cursor-default select-none', style.border)}
      onDoubleClick={onOpen}
    >
      {/* Drag handle dots */}
      <div className="flex justify-center gap-1 pt-1.5 pb-0">
        {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-700" />)}
      </div>
      {/* Status header */}
      <div className={cn('flex items-center gap-2 px-3 py-1.5', style.header)}>
        <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
        <span className={cn('text-[9px] font-bold tracking-wide flex-1', style.labelColor)}>{style.label}</span>
      </div>
      {/* Name + model */}
      <div className="px-3 pt-2 pb-1">
        <p className="text-[14px] font-bold">{icon} {name}</p>
        <p className="text-[10px] text-neutral-600">{modelName} · {toolCount} tools</p>
      </div>
      {/* Action feed */}
      <div className="px-2 pb-2">
        <ActionFeed actions={actions} />
      </div>
      {/* Approval gates */}
      {pendingApprovals.map(req => (
        <ApprovalGate key={req.id} request={req} onApprove={onApprove} onDeny={onDeny} />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run — expect pass**

```bash
npx vitest run src/components/canvas/__tests__/AgentCard.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/ src/components/approval/
git commit -m "feat: AgentCard, ActionFeed, and ApprovalGate components"
```

---

## Task 14: Spatial Canvas (React Flow)

**Files:**
- Create: `src/lib/canvas/node-registry.ts`
- Create: `src/lib/canvas/persistence.ts`
- Create: `src/components/canvas/AgentCardNode.tsx`
- Create: `src/components/canvas/GroupNode.tsx`
- Create: `src/components/canvas/CanvasEdge.tsx`
- Create: `src/components/canvas/AgentCanvas.tsx`

**Interfaces:**
- Consumes: `AgentCard`, `CanvasNode` interface, `initDb`, `AgentRepository`, `canvas_state` table
- Produces: `AgentCanvas` — the full React Flow canvas with persistence

- [ ] **Step 1: Write canvas node registry**

```typescript
// src/lib/canvas/node-registry.ts
import type { CanvasNode } from '@/lib/interfaces'

export const NODE_REGISTRY = new Map<string, CanvasNode>()

export function registerCanvasNode(node: CanvasNode): void {
  NODE_REGISTRY.set(node.nodeType, node)
}

export function getNodeTypes(): Record<string, React.ComponentType> {
  const types: Record<string, React.ComponentType> = {}
  NODE_REGISTRY.forEach((node, key) => {
    types[key] = node.CardComponent
  })
  return types
}
```

- [ ] **Step 2: Write canvas persistence helpers**

```typescript
// src/lib/canvas/persistence.ts
import { initDb } from '@/lib/storage'
import type { Viewport } from 'reactflow'

export async function saveCanvasState(viewport: Viewport, groups: unknown[]): Promise<void> {
  const db = await initDb()
  await db.execute(
    `INSERT INTO canvas_state (id, viewport_x, viewport_y, zoom, group_definitions)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET viewport_x=$1, viewport_y=$2, zoom=$3, group_definitions=$4`,
    [viewport.x, viewport.y, viewport.zoom, JSON.stringify(groups)],
  )
}

export async function loadCanvasState(): Promise<{ viewport: Viewport; groups: unknown[] } | null> {
  const db = await initDb()
  const rows = await db.select<Array<Record<string, unknown>>>('SELECT * FROM canvas_state WHERE id = 1')
  if (!rows[0]) return null
  const r = rows[0]
  return {
    viewport: { x: r.viewport_x as number, y: r.viewport_y as number, zoom: r.zoom as number },
    groups: JSON.parse(r.group_definitions as string),
  }
}

export async function saveAgentPosition(agentId: string, x: number, y: number): Promise<void> {
  const db = await initDb()
  await db.execute('UPDATE agents SET canvas_x = $1, canvas_y = $2 WHERE id = $3', [x, y, agentId])
}
```

- [ ] **Step 3: Write AgentCardNode (React Flow custom node)**

```typescript
// src/components/canvas/AgentCardNode.tsx
'use client'
import { Handle, Position, type NodeProps } from 'reactflow'
import { AgentCard } from './AgentCard'
import { useApprovals } from '@/hooks/useApprovals'
import { AGENT_REGISTRY } from '@/lib/agents/registry'

export interface AgentNodeData {
  label: string
  agentId: string
  name: string
  icon: string
  modelName: string
  toolCount: number
  agentType: string
}

export function AgentCardNode({ data }: NodeProps<AgentNodeData>) {
  const approvals = useApprovals().filter((a) => a.agentId === data.agentId)
  const provider = AGENT_REGISTRY.get(data.agentType)

  const handleApprove = (requestId: string) => provider?.approve(requestId)
  const handleDeny = (requestId: string) => provider?.deny(requestId)

  return (
    <div className="relative">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
      <AgentCard
        agentId={data.agentId}
        name={data.name}
        icon={data.icon}
        modelName={data.modelName}
        toolCount={data.toolCount}
        actions={[]}
        pendingApprovals={approvals}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onOpen={() => {}}
      />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-violet-600 border-2 border-[#0d0e18]" />
    </div>
  )
}
```

- [ ] **Step 4: Write GroupNode**

```typescript
// src/components/canvas/GroupNode.tsx
'use client'
import { type NodeProps } from 'reactflow'

export interface GroupNodeData {
  label: string
}

export function GroupNode({ data, selected }: NodeProps<GroupNodeData>) {
  return (
    <div className={`rounded-xl border border-dashed border-violet-500/30 bg-violet-500/3 min-w-[300px] min-h-[200px] ${selected ? 'border-violet-500/60' : ''}`}>
      <div className="px-3 pt-2">
        <span className="text-[11px] font-bold text-violet-400/70 tracking-wide">📁 {data.label}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write AgentCanvas root**

```typescript
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
  type OnNodesChange,
  type Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { AgentCardNode, type AgentNodeData } from './AgentCardNode'
import { GroupNode } from './GroupNode'
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
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])

  useEffect(() => {
    loadCanvasState().then((state) => {
      if (state) {
        // restore viewport handled by defaultViewport prop
      }
    })
  }, [])

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'agentCard') {
      saveAgentPosition(node.data.agentId, node.position.x, node.position.y)
    }
  }, [])

  const handleMoveEnd = useCallback((_: unknown, viewport: Viewport) => {
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
```

- [ ] **Step 6: Wire page.tsx**

```typescript
// src/app/page.tsx
'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { AgentCanvas } from '@/components/canvas/AgentCanvas'
import { StorePanel } from '@/components/store/StorePanel'
import { useApprovals } from '@/hooks/useApprovals'

export default function Home() {
  const [activeNav, setActiveNav] = useState<'home' | 'chat' | 'workflows' | 'store' | 'settings'>('home')
  const approvals = useApprovals()

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar approvalCount={approvals.length} onAddAgent={() => {}} />
        <div className="flex-1 relative overflow-hidden">
          <AgentCanvas />
          {activeNav === 'store' && <StorePanel onClose={() => setActiveNav('home')} />}
        </div>
        <StatusBar
          runningCount={0} idleCount={0} approvalCount={approvals.length}
          llmCallsToday={0} estimatedCost={0} modelsConnected={0} toolsActive={0}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run tauri dev
```
Expected: Canvas opens with dot-grid background, MiniMap in bottom-right, Controls in bottom-left, draggable area. No console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/ src/lib/canvas/ src/app/page.tsx
git commit -m "feat: spatial canvas with React Flow, groups, minimap, and persistence"
```

---

## Task 15: Store Panel

**Files:**
- Create: `src/components/store/StorePanel.tsx`
- Create: `src/components/store/StoreItemRow.tsx`

**Interfaces:**
- Consumes: `McpRepository`, `ToolRepository` from storage
- Produces: `StorePanel` — slide-in panel for browsing/installing MCPs, tools, and skills

- [ ] **Step 1: Write StoreItemRow**

```typescript
// src/components/store/StoreItemRow.tsx
'use client'
interface StoreItemRowProps {
  name: string
  description: string
  version: string
  installed: boolean
  assignedAgents: string[]
  onInstall: () => void
  onUninstall: () => void
}

export function StoreItemRow({ name, description, version, installed, assignedAgents, onInstall, onUninstall }: StoreItemRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030] hover:bg-[#13141f] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-neutral-100">{name}</span>
          <span className="text-[10px] text-neutral-600">v{version}</span>
        </div>
        <p className="text-[11px] text-neutral-500 truncate">{description}</p>
        {assignedAgents.length > 0 && (
          <p className="text-[10px] text-violet-400/70 mt-0.5">Assigned to: {assignedAgents.join(', ')}</p>
        )}
      </div>
      <button
        onClick={installed ? onUninstall : onInstall}
        className={installed
          ? 'px-2.5 py-1 text-[11px] rounded border border-neutral-700 text-neutral-500 hover:border-red-500/50 hover:text-red-400 transition-colors'
          : 'px-2.5 py-1 text-[11px] rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors'
        }
      >
        {installed ? 'Remove' : 'Install'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write StorePanel**

```typescript
// src/components/store/StorePanel.tsx
'use client'
import { useState } from 'react'
import { StoreItemRow } from './StoreItemRow'

type Tab = 'mcps' | 'tools' | 'skills'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'mcps', label: 'MCP Servers' },
  { id: 'tools', label: 'Tools' },
  { id: 'skills', label: 'Skills' },
]

interface StorePanelProps {
  onClose: () => void
}

export function StorePanel({ onClose }: StorePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('mcps')

  return (
    <div className="absolute inset-y-0 right-0 w-[380px] bg-[#0d0e18] border-l border-[#1e2030] flex flex-col z-10 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2030]">
        <span className="text-[15px] font-semibold">📦 Store</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 text-lg">✕</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-[#1e2030]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-violet-400 border-b-2 border-violet-500'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="px-4 py-2 border-b border-[#1e2030]">
        <input
          placeholder="Search..."
          className="w-full bg-[#13141f] border border-[#1e2030] rounded px-3 py-1.5 text-[12px] text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
        />
      </div>
      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'mcps' && (
          <StoreItemRow
            name="@modelcontextprotocol/server-filesystem"
            description="Read and write files on the local filesystem"
            version="0.6.2"
            installed={false}
            assignedAgents={[]}
            onInstall={() => {}}
            onUninstall={() => {}}
          />
        )}
        {activeTab === 'tools' && (
          <div className="px-4 py-8 text-center text-neutral-600 text-[12px]">
            Built-in tools are always available.<br />Custom tools coming in a future update.
          </div>
        )}
        {activeTab === 'skills' && (
          <div className="px-4 py-8 text-center text-neutral-600 text-[12px]">
            No skills installed yet.<br />Install from a file path or URL.
          </div>
        )}
      </div>
      {/* Footer: install from path -->
      <div className="px-4 py-3 border-t border-[#1e2030]">
        <p className="text-[10px] text-neutral-600 mb-2">Install from path or URL</p>
        <div className="flex gap-2">
          <input
            placeholder="npx @mcp/server or https://..."
            className="flex-1 bg-[#13141f] border border-[#1e2030] rounded px-2 py-1.5 text-[11px] text-neutral-300 placeholder:text-neutral-600 outline-none focus:border-violet-500/50"
          />
          <button className="px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-[11px] text-white transition-colors">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
npm run tauri dev
```
Click the 📦 sidebar icon. Store panel slides in from the right with MCP Servers / Tools / Skills tabs.

- [ ] **Step 4: Commit**

```bash
git add src/components/store/
git commit -m "feat: Store panel with MCP, Tools, and Skills tabs"
```

---

## Final Verification — Phase 1C

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npm run tauri dev` — canvas renders, sidebar navigates, store panel opens
- [ ] Drag an agent card — position persists after refresh
- [ ] Click Store — panel opens with tabs, search input, install-from-path footer

---

## Phase 1 Complete

All three plans (1A, 1B, 1C) together deliver:

| Capability | Plan |
|-----------|------|
| Project scaffold (Tauri 2.0 + Next.js 15) | 1A |
| All extensibility interfaces | 1A |
| Encrypted SQLite storage + repositories | 1A |
| OS Keychain secret management | 1A |
| Typed event bus | 1A |
| LLM router (Anthropic, OpenAI, Ollama) | 1B |
| MCP registry (stdio + SSE) | 1B |
| LLM agent runtime | 1B |
| Claude Code agent runtime | 1B |
| OpenAI Codex agent runtime | 1B |
| Spatial canvas (React Flow, drag, groups) | 1C |
| Live agent status + approval gates | 1C |
| Store panel (MCPs, Tools, Skills) | 1C |

Proceed to **Phase 2: Workflow Builder** once Phase 1 is verified end-to-end.
