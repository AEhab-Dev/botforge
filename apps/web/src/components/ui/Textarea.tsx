import { cn } from '../../lib/utils'
import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-[8px] border bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text)]',
            'placeholder:text-[var(--text-muted)] transition-colors duration-150 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:border-transparent',
            error
              ? 'border-[var(--error)]/50'
              : 'border-[var(--border)] hover:border-[var(--border-strong)]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--error)]" role="alert">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
