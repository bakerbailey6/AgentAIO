// src/app/page.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { AgentCanvas } from '@/components/canvas/AgentCanvas'
import { StorePanel } from '@/components/store/StorePanel'
import { WorkflowsPanel } from '@/components/workflows/WorkflowsPanel'
import SettingsPanel from '@/components/settings/SettingsPanel'
import CreateAgentPanel from '@/components/agents/CreateAgentPanel'
import EditAgentPanel from '@/components/agents/EditAgentPanel'
import ChatPanel from '@/components/chat/ChatPanel'
import { VaultGate } from '@/components/vault/VaultGate'
import { useApprovals } from '@/hooks/useApprovals'
import { useAgentCounts } from '@/hooks/useAgentCounts'
import { initDb, AgentRepository, SessionRepository, ToolRepository } from '@/lib/storage'
import { ModelRepository } from '@/lib/storage/repositories/models'
import type { AgentRow } from '@/lib/storage'

type NavItem = 'home' | 'chat' | 'workflows' | 'store' | 'settings'

export default function Home() {
  const [activeNav, setActiveNav] = useState<NavItem>('home')
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [chatAgentId, setChatAgentId] = useState<string | null>(null)
  const [lastChatAgentId, setLastChatAgentId] = useState<string | null>(null)
  const [editAgentId, setEditAgentId] = useState<string | null>(null)
  const approvals = useApprovals()
  const { running, idle } = useAgentCounts()
  const [modelsConnected, setModelsConnected] = useState(0)
  const [toolsActive, setToolsActive] = useState(0)
  const [llmCalls, setLlmCalls] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)

  const handleOpenChat = useCallback((agentId: string) => {
    setChatAgentId(agentId)
    setLastChatAgentId(agentId)
  }, [])

  const handleEditAgent = useCallback((agentId: string) => setEditAgentId(agentId), [])

  // The "Chat" sidebar item is a per-agent overlay, not a standalone panel.
  // Opening it should resume the most recent (or first) agent's chat; with no
  // agents yet, guide the user to create one instead of dead-ending.
  const handleNavigate = useCallback((item: NavItem) => {
    if (item === 'chat') {
      const target = chatAgentId ?? lastChatAgentId ?? agents[0]?.id ?? null
      if (target) {
        setChatAgentId(target)
        setLastChatAgentId(target)
      } else {
        setShowCreateAgent(true)
      }
      return
    }
    setActiveNav(item)
  }, [chatAgentId, lastChatAgentId, agents])

  useEffect(() => {
    initDb()
      .then((db) => new AgentRepository(db).findAll())
      .then(setAgents)
      .catch(console.error)
  }, [])

  useEffect(() => {
    initDb()
      .then(db => new ModelRepository(db).findAll())
      .then(rows => setModelsConnected(rows.length))
      .catch(() => {})
  }, [])

  // Footer usage metrics — derived from real persisted state (loaded on mount)
  // rather than the previous hardcoded zeros. `toolsActive` = installed tools;
  // `llmCalls` = recorded assistant turns across sessions; `estimatedCost` =
  // summed per-session cost estimate.
  useEffect(() => {
    initDb()
      .then(db => new ToolRepository(db).findAll())
      .then(rows => setToolsActive(rows.length))
      .catch(() => {})
    initDb()
      .then(db => new SessionRepository(db).findAll())
      .then(sessions => {
        let calls = 0
        let cost = 0
        for (const s of sessions) {
          cost += s.costEstimate ?? 0
          for (const m of s.messages ?? []) {
            if ((m as { role?: string }).role === 'assistant') calls++
          }
        }
        setLlmCalls(calls)
        setEstimatedCost(cost)
      })
      .catch(() => {})
  }, [agents, chatAgentId])

  return (
    <VaultGate>
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar activeItem={activeNav} onNavigate={handleNavigate} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar approvalCount={approvals.length} onAddAgent={() => setShowCreateAgent(true)} />
        <div className="flex-1 relative overflow-hidden">
          <AgentCanvas
            agents={agents}
            onOpenChat={handleOpenChat}
            onEdit={handleEditAgent}
          />
          {activeNav === 'store' && <StorePanel onClose={() => setActiveNav('home')} />}
          {activeNav === 'settings' && <SettingsPanel onClose={() => setActiveNav('home')} />}
          {activeNav === 'workflows' && <WorkflowsPanel onClose={() => setActiveNav('home')} />}
          <CreateAgentPanel
            open={showCreateAgent}
            onClose={() => setShowCreateAgent(false)}
            onCreated={(row) => {
              setAgents((prev) => [...prev, row])
              // do NOT setShowCreateAgent(false) here — onClose handles that
            }}
            onNavigateToSettings={() => { setShowCreateAgent(false); setActiveNav('settings') }}
          />
          <ChatPanel agentId={chatAgentId} onClose={() => setChatAgentId(null)} />
          {editAgentId && (
            <EditAgentPanel agentId={editAgentId} onClose={() => setEditAgentId(null)}
              onSaved={(row) => setAgents((prev) => prev.map((a) => (a.id === row.id ? row : a)))}
              onNavigateToSettings={() => { setEditAgentId(null); setActiveNav('settings') }} />
          )}
        </div>
        <StatusBar
          runningCount={running}
          idleCount={idle}
          approvalCount={approvals.length}
          llmCallsToday={llmCalls}
          estimatedCost={estimatedCost}
          modelsConnected={modelsConnected}
          toolsActive={toolsActive}
        />
      </div>
    </div>
    </VaultGate>
  )
}
