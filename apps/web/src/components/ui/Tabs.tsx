import { cn } from '../../lib/utils'
import { createContext, useContext, type ReactNode } from 'react'

interface TabsCtx { active: string; set: (v: string) => void }
const Ctx = createContext<TabsCtx>({ active: '', set: () => {} })

export function Tabs({ value, onChange, children, className }: {
  value: string; onChange: (v: string) => void; children: ReactNode; className?: string
}) {
  return (
    <Ctx.Provider value={{ active: value, set: onChange }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-1 border-b border-[var(--border)]', className)} role="tablist">
      {children}
    </div>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { active, set } = useContext(Ctx)
  const isActive = active === value
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => set(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px',
        isActive
          ? 'text-[var(--text)] border-b-2 border-[var(--purple)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { active } = useContext(Ctx)
  if (active !== value) return null
  return <div className={cn('animate-fade-in', className)}>{children}</div>
}
