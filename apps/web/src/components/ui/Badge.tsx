import { cn } from '../../lib/utils'

type BadgeVariant = 'default' | 'purple' | 'success' | 'warning' | 'error' | 'info' | 'mint'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  pulse?: boolean
  className?: string
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:  'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]',
  purple:   'bg-[var(--purple-tint)] text-[var(--purple-light)] border-[var(--purple)]/20',
  success:  'bg-[#4ade8015] text-[var(--success)] border-[var(--success)]/20',
  warning:  'bg-[#fbbf2415] text-[var(--warning)] border-[var(--warning)]/20',
  error:    'bg-[#fb718515] text-[var(--error)] border-[var(--error)]/20',
  info:     'bg-[#60a5fa15] text-[var(--info)] border-[var(--info)]/20',
  mint:     'bg-[#4de0c115] text-[var(--mint)] border-[var(--mint)]/20',
}

const DOT_COLORS: Record<BadgeVariant, string> = {
  default: 'bg-[var(--text-muted)]',
  purple:  'bg-[var(--purple-light)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  error:   'bg-[var(--error)]',
  info:    'bg-[var(--info)]',
  mint:    'bg-[var(--mint)]',
}

export function Badge({ children, variant = 'default', dot, pulse, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
      VARIANTS[variant],
      className
    )}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          DOT_COLORS[variant],
          pulse && 'animate-pulse-soft'
        )} />
      )}
      {children}
    </span>
  )
}
