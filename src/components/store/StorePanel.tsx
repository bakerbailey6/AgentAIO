// src/components/store/StorePanel.tsx
'use client'

interface StorePanelProps {
  onClose: () => void
}

export function StorePanel({ onClose }: StorePanelProps) {
  return (
    <div className="absolute inset-y-0 right-0 w-[360px] bg-[#0d0e1a] border-l border-[#1e2030] flex flex-col z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2030]">
        <span className="text-[13px] font-semibold text-neutral-100">Agent Store</span>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-300 text-lg leading-none"
          aria-label="Close store"
        >
          ×
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-neutral-600">Coming soon</p>
      </div>
    </div>
  )
}
