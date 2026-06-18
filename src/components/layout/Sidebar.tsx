'use client'
import { cn } from '@/lib/utils'
import { LayoutGrid, MessageSquare, GitBranch, Package, Settings } from 'lucide-react'

type NavItem = 'home' | 'chat' | 'workflows' | 'store' | 'settings'

const NAV_ITEMS: Array<{ id: NavItem; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', Icon: LayoutGrid },
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'workflows', label: 'Workflows', Icon: GitBranch },
  { id: 'store', label: 'Store', Icon: Package },
]

interface SidebarProps {
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
}

export function Sidebar({ activeItem, onNavigate }: SidebarProps) {
  return (
    <aside className="w-14 h-full bg-[#09090b] border-r border-white/[0.06] flex flex-col items-center py-3 gap-1 shrink-0">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          aria-label={item.label}
          onClick={() => onNavigate(item.id)}
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150',
            activeItem === item.id
              ? 'bg-violet-600 text-white'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]',
          )}
        >
          <item.Icon className="w-[18px] h-[18px]" />
        </button>
      ))}
      <div className="flex-1" />
      <button
        aria-label="Settings"
        onClick={() => onNavigate('settings')}
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150',
          activeItem === 'settings'
            ? 'bg-violet-600 text-white'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]',
        )}
      >
        <Settings className="w-[18px] h-[18px]" />
      </button>
    </aside>
  )
}
