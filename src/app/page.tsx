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
import { useApprovals } from '@/hooks/useApprovals'
import { initDb, AgentRepository } from '@/lib/storage'
import type { AgentRow } from '@/lib/storage'

export default function Home() {
  const [activeNav, setActiveNav] = useState<'home' | 'chat' | 'workflows' | 'store' | 'settings'>('home')
  const [showCreateAgent, setShowCreateAgent] = useState(false)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [chatAgentId, setChatAgentId] = useState<string | null>(null)
  const approvals = useApprovals()

  const handleOpenChat = useCallback((agentId: string) => {
    setChatAgentId(agentId)
  }, [])

  useEffect(() => {
    initDb()
      .then((db) => new AgentRepository(db).findAll())
      .then(setAgents)
      .catch(console.error)
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
          {/* ChatPanel rendered in Task C */}
        </div>
        <StatusBar
          runningCount={0} idleCount={0} approvalCount={approvals.length}
          llmCallsToday={0} estimatedCost={0} modelsConnected={0} toolsActive={0}
        />
      </div>
    </div>
  )
}
