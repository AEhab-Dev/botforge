import { cn } from '../../lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, icon, iconRight, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          'disabled:opacity-40 disabled:cursor-not-allowed select-none',
          {
            'bg-[var(--purple)] text-white hover:bg-[var(--purple-hover)] active:scale-[0.98] shadow-sm': variant === 'primary',
            'bg-[var(--bg-raised)] text-[var(--text)] hover:bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--border-strong)]': variant === 'secondary',
            'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] border border-transparent': variant === 'outline',
            'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]': variant === 'ghost',
            'bg-[#fb718520] text-[var(--error)] hover:bg-[#fb718530] border border-[var(--error)]/20': variant === 'danger',
          },
          {
            'text-xs px-2.5 h-7': size === 'xs',
            'text-sm px-3 h-8': size === 'sm',
            'text-sm px-4 h-9': size === 'md',
            'text-base px-5 h-11': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : icon ? (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        ) : null}
        {children}
        {iconRight && !loading && (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{iconRight}</span>
        )}
      </button>
    )
  }
)
Button.displayName = 'Button'
