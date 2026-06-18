'use client'
import { useState, useEffect, useCallback } from 'react'
import { initDb } from '@/lib/storage/db'
import { ModelRepository } from '@/lib/storage/repositories/models'
import type { ModelRow } from '@/lib/storage/repositories/models'

interface ModelListProps {
  onRefresh?: () => void
}

export default function ModelList({ onRefresh }: ModelListProps) {
  const [models, setModels] = useState<ModelRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadModels = useCallback(async () => {
    setLoading(true)
    try {
      const db = await initDb()
      const repo = new ModelRepository(db)
      const rows = await repo.findAll()
      setModels(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadModels()
  }, [loadModels])

  async function handleDelete(id: string) {
    const db = await initDb()
    const repo = new ModelRepository(db)
    await repo.delete(id)
    await loadModels()
    onRefresh?.()
  }

  if (loading) {
    return (
      <div className="py-6 text-center text-zinc-500 text-[13px]">Loading models…</div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="py-6 text-center text-zinc-500 text-[13px]">
        No models configured. Add one to get started.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {models.map((model) => (
        <div
          key={model.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
        >
          <span className="text-[10px] bg-white/[0.06] text-zinc-400 rounded-full px-2 py-0.5 shrink-0">
            {model.provider}
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[13px] font-medium text-zinc-200 truncate">{model.displayName}</span>
            <span className="text-[11px] text-zinc-500 truncate">{model.modelName}</span>
          </div>
          <button
            onClick={() => handleDelete(model.id)}
            className="text-red-400 hover:text-red-300 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
