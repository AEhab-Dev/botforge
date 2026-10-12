import { useLocation } from 'react-router-dom'
import { Menu, Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/bots/new': 'Create Bot',
  '/bots': 'My Bots',
  '/billing': 'Billing & Usage',
  '/settings': 'Settings',
  '/docs': 'Documentation',
  '/support': 'Support',
}

interface TopbarProps { onMenuClick: () => void }

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()

  const title = Object.entries(PAGE_TITLES)
    .filter(([path]) => pathname === path || pathname.startsWith(path + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'BotForge'

  return (
    <header
      className="flex items-center justify-between h-16 px-6 border-b border-[var(--border)] shrink-0"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden text-[var(--text-muted)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--bg-hover)]"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-semibold text-[var(--text)]">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="text-[var(--text-muted)] hover:text-[var(--text)] p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="sr-only">Notifications</span>
        </button>
      </div>
    </header>
  )
}
