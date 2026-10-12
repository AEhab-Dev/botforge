import { cn } from '../../lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  description?: string
  size?: 'sm' | 'md'
}

export function Toggle({ checked, onChange, disabled, label, description, size = 'md' }: ToggleProps) {
  return (
    <label className={cn('flex items-start gap-3 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
      <div className="flex items-center">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
            size === 'sm' ? 'w-8 h-4' : 'w-10 h-5',
            checked ? 'bg-[var(--purple)]' : 'bg-[var(--border-strong)]'
          )}
        >
          <span className={cn(
            'absolute top-0.5 rounded-full bg-white shadow transition-transform duration-200',
            size === 'sm' ? 'w-3 h-3' : 'w-4 h-4',
            checked
              ? size === 'sm' ? 'translate-x-4' : 'translate-x-5'
              : 'translate-x-0.5'
          )} />
        </button>
      </div>
      {(label || description) && (
        <div>
          {label && <p className="text-sm font-medium text-[var(--text)]">{label}</p>}
          {description && <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>}
        </div>
      )}
    </label>
  )
}
