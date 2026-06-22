// src/components/workflows/RunModal.tsx
'use client'
import { useState } from 'react'

export interface RunModalProps {
  open: boolean
  onClose: () => void
  onRun: (input: unknown) => void
}

/**
 * Centered modal for entering the Start-node input before running a workflow.
 * The textarea value is parsed as JSON; if parsing fails the raw string is
 * passed through to `onRun` unchanged.
 */
export function RunModal({ open, onClose, onRun }: RunModalProps): React.JSX.Element | null {
  const [value, setValue] = useState('')

  if (!open) return null

  // The parent keeps this component mounted, so `useState` does not re-init
  // between opens. Clear the input on every exit path (Run / Cancel / close) so
  // a previous run's Start input never leaks into the next open.
  const handleClose = () => {
    setValue('')
    onClose()
  }

  const handleRun = () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = value
    }
    onRun(parsed)
    setValue('')
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] bg-[#0d0d0f] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <span className="text-[14px] font-semibold text-zinc-100">Run workflow</span>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-[16px] leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Start input
          </label>
          <textarea
            rows={6}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='{ "key": "value" }'
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 font-mono focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600 resize-none"
          />
          <p className="text-[11px] text-zinc-500 mt-1.5">
            Parsed as JSON when valid, otherwise passed as plain text.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.08] flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="text-zinc-300 hover:text-white text-[12px] font-medium rounded-lg px-4 py-2 border border-white/[0.08] hover:border-white/[0.15] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            className="bg-white text-[#09090b] text-[12px] font-semibold rounded-lg px-4 py-2 hover:bg-zinc-100 transition-colors"
          >
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
