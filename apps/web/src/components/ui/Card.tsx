import { cn } from '../../lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)]',
        className
      )}
      {...props}
    />
  )
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional icon shown left of the title */
  icon?: ReactNode
  /** Renders a bold title line */
  title?: string
  /** Renders a muted description line below the title */
  description?: string
}

export function CardHeader({ className, icon, title, description, children, ...props }: CardHeaderProps) {
  // If structured props are passed, render the compound layout;
  // otherwise fall back to rendering children as-is (plain wrapper behaviour).
  const hasStructured = icon !== undefined || title !== undefined || description !== undefined

  return (
    <div className={cn('px-5 py-4 border-b border-[var(--border)]', className)} {...props}>
      {hasStructured ? (
        <div className="flex items-start gap-3">
          {icon && (
            <span className="mt-0.5 shrink-0 text-[var(--text-muted)]">{icon}</span>
          )}
          <div className="flex-1 min-w-0">
            {title && <p className="text-sm font-semibold text-[var(--text)]">{title}</p>}
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            )}
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-3', className)}
      {...props}
    />
  )
}
