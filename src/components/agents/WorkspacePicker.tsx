'use client'
import { isTauri } from '@/lib/platform'

interface WorkspacePickerProps {
  value: string
  onChange: (path: string) => void
  label?: string
  hint?: string
}

/**
 * Workspace-folder field with a native "Browse…" picker (the OS finder/explorer),
 * plus a typed-path fallback. The folder becomes the agent's allowed root — what
 * gives it Claude-Code-style read/search/edit/shell access to a repo.
 *
 * The dialog plugin is desktop-only, so it's dynamically imported on click and
 * the button is disabled in web mode.
 */
export function WorkspacePicker({ value, onChange, label = 'Workspace Folder', hint }: WorkspacePickerProps) {
  const desktop = isTauri()

  async function browse() {
    if (!desktop) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true, multiple: false, title: 'Select workspace folder' })
      if (typeof selected === 'string') onChange(selected)
    } catch {
      // Picker unavailable (web/permissions) — the typed field still works.
    }
  }

  return (
    <div>
      <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/path/to/repo"
          className="flex-1 min-w-0 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-indigo-500/50 placeholder:text-zinc-600"
        />
        <button
          type="button"
          onClick={browse}
          disabled={!desktop}
          title={desktop ? 'Choose a folder' : 'Folder picker is available in the desktop app'}
          className="shrink-0 text-zinc-300 hover:text-white text-[12px] font-medium border border-white/[0.08] rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
        >
          Browse…
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1">
        {hint ?? 'The repo/folder the agent can read, search, and edit — like Claude Code.'}
      </p>
    </div>
  )
}
