// src/app/page.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { StatusBar } from '@/components/layout/StatusBar'
import { AgentCanvas } from '@/components/canvas/AgentCanvas'
import { StorePanel } from '@/components/store/StorePanel'
import SettingsPanel from '@/components/settings/SettingsPanel'
import CreateAgentPanel from '@/components/agents/CreateAgentPanel'
import ChatPanel from '@/components/chat/ChatPanel'
import { useApprovals } from '@/hooks/useApprovals'
import { useAgentCounts } from '@/hooks/useAgentCounts'
import { initDb, AgentRepository } from '@/lib/storage'
import { ModelRepository } from '@/lib/storage/repositories/models'
import type { AgentRow } from '@/lib/storage'

export default function Home() {
  const [activeNav, setActiveNav] = useState<'home' | 'chat' | 'workflows' | 'store' | 'settings'>('home')
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [chatAgentId, setChatAgentId] = useState<string | null>(null)
  const approvals = useApprovals()
  const { running, idle } = useAgentCounts()
  const [modelsConnected, setModelsConnected] = useState(0)

  const handleOpenChat = useCallback((agentId: string) => {
    setChatAgentId(agentId)
  }, [])

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

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar approvalCount={approvals.length} onAddAgent={() => setShowCreateAgent(true)} />
        <div className="flex-1 relative overflow-hidden">
          <AgentCanvas
            agents={agents}
            onOpenChat={handleOpenChat}
          />
          {activeNav === 'store' && <StorePanel onClose={() => setActiveNav('home')} />}
          {activeNav === 'settings' && <SettingsPanel onClose={() => setActiveNav('home')} />}
          <CreateAgentPanel
            open={showCreateAgent}
            onClose={() => setShowCreateAgent(false)}
            onCreated={(row) => {
              setAgents((prev) => [...prev, row])
              // do NOT setShowCreateAgent(false) here — onClose handles that
            }}
          />
          <ChatPanel agentId={chatAgentId} onClose={() => setChatAgentId(null)} />
        </div>
        <StatusBar
          runningCount={running}
          idleCount={idle}
          approvalCount={approvals.length}
          llmCallsToday={0}
          estimatedCost={0}
          modelsConnected={modelsConnected}
          toolsActive={0}
        />
      </div>
    </div>
  )
}
