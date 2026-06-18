'use client'
import { cn } from '@/lib/utils'

type NavItem = 'home' | 'chat' | 'workflows' | 'store' | 'settings'

const NAV_ITEMS: Array<{ id: NavItem; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'store', label: 'Store', icon: '📦' },
]

interface SidebarProps {
  activeItem: NavItem
  onNavigate: (item: NavItem) => void
}

export function Sidebar({ activeItem, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[52px] h-full bg-[#080910] flex flex-col items-center py-3 gap-2 shrink-0">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          aria-label={item.label}
          onClick={() => onNavigate(item.id)}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors',
            activeItem === item.id
              ? 'bg-violet-600 text-white'
              : 'bg-[#13141f] text-neutral-500 hover:text-neutral-300',
          )}
        >
          {item.icon}
        </button>
      ))}
      <div className="flex-1" />
      <button
        aria-label="Settings"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-[#13141f] text-neutral-500 hover:text-neutral-300"
      >
        ⚙
      </button>
    </aside>
  )
}
