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
      {/* Footer: install from path */}
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
