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
        <TopBar approvalCount={approvals.length} onAddAgent={() => setActiveNav('store')} />
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
