import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--purple-tint)] flex items-center justify-center mb-5 [&>svg]:w-7 [&>svg]:h-7 [&>svg]:text-[var(--purple-light)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--text)] mb-1.5">{title}</h3>
      {description && <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">{description}</p>}
      {action}
    </div>
  )
}
