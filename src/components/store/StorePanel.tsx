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
    <div className="absolute inset-y-0 right-0 w-80 bg-[#0d0d0f] border-l border-white/[0.08] flex flex-col z-10 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <span className="text-[13px] font-semibold text-zinc-200">Store</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none">✕</button>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[12px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-zinc-200 border-b-2 border-indigo-500'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* Search */}
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <input
          placeholder="Search..."
          className="bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-zinc-300 placeholder:text-zinc-600 px-3 py-1.5 w-full focus:outline-none focus:border-indigo-500/50 transition-colors"
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
          <div className="px-4 py-8 text-center text-zinc-600 text-[12px] leading-relaxed">
            Built-in tools are always available.<br />Custom tools coming in a future update.
          </div>
        )}
        {activeTab === 'skills' && (
          <div className="px-4 py-8 text-center text-zinc-600 text-[12px] leading-relaxed">
            No skills installed yet.<br />Install from a file path or URL.
          </div>
        )}
      </div>
      {/* Footer: install from path */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[11px] text-zinc-500 mb-2">Install from path or URL</p>
        <div className="flex gap-2">
          <input
            placeholder="npx @mcp/server or https://..."
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-[11px] font-semibold text-white transition-colors">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
