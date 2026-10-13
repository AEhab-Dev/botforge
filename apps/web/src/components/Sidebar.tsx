import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, Plus, CreditCard,
  BookOpen, HelpCircle, Settings, LogOut, Zap, X, Users,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/client'

interface SidebarProps { onClose?: () => void }

function NavItem({ to, icon: Icon, label, highlight, onClick, end }: {
  to: string; icon: React.ElementType; label: string
  highlight?: boolean; onClick?: () => void; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150',
        highlight
          ? 'bg-[var(--purple)] text-white hover:bg-[var(--purple-hover)] shadow-sm'
          : isActive
          ? 'bg-[var(--purple-tint)] text-[var(--purple-light)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export function Sidebar({ onClose }: SidebarProps) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await authApi.logout().catch(() => {})
    setUser(null)
    navigate('/login')
  }

  return (
    <aside
      className="flex flex-col w-[248px] h-full border-r border-[var(--border)] shrink-0"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--border)] shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[var(--text)] text-base tracking-tight">BotForge</span>
        </NavLink>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] md:hidden p-1"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end onClick={onClose} />
          <NavItem to="/bots" icon={Bot} label="My Bots" onClick={onClose} />
          <NavItem to="/bots/new" icon={Plus} label="Create Bot" highlight onClick={onClose} />
        </div>

        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Management
          </p>
          <div className="space-y-1">
            <NavItem to="/workspace" icon={Users} label="Workspace" onClick={onClose} />
            <NavItem to="/billing" icon={CreditCard} label="Billing" onClick={onClose} />
          </div>
        </div>
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-[var(--border)] space-y-1">
        <NavItem to="/docs" icon={BookOpen} label="Documentation" onClick={onClose} />
        <NavItem to="/support" icon={HelpCircle} label="Support" onClick={onClose} />
        <NavItem to="/settings" icon={Settings} label="Settings" onClick={onClose} />

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-[var(--purple-tint)] flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-[var(--purple-light)]">
              {user?.displayName?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--text)] truncate">{user?.displayName}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1"
            aria-label="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
