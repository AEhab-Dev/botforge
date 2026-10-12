import { cn } from '../../lib/utils'
import { Check } from 'lucide-react'

interface Step { label: string; description?: string }

interface StepIndicatorProps {
  steps: Step[]
  current: number
  className?: string
}

export function StepIndicator({ steps, current, className }: StepIndicatorProps) {
  return (
    <nav aria-label="Progress" className={cn('flex items-center gap-0', className)}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all',
                done  && 'bg-[var(--purple)] border-[var(--purple)] text-white',
                active && 'bg-[var(--purple-tint)] border-[var(--purple)] text-[var(--purple-light)]',
                !done && !active && 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)]'
              )}>
                {done ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
              </div>
              <span className={cn(
                'text-xs font-medium whitespace-nowrap hidden sm:block',
                active ? 'text-[var(--text)]' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                'h-0.5 w-12 md:w-20 mx-1 mb-5 transition-colors',
                i < current ? 'bg-[var(--purple)]' : 'bg-[var(--border)]'
              )} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
