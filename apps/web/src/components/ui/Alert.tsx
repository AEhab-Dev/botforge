import { cn } from '../../lib/utils'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const STYLES: Record<AlertVariant, { container: string; icon: ReactNode }> = {
  info:    { container: 'bg-[#60a5fa10] border-[var(--info)]/20 text-[var(--info)]',    icon: <Info className="w-4 h-4 shrink-0 mt-0.5" /> },
  success: { container: 'bg-[#4ade8010] border-[var(--success)]/20 text-[var(--success)]', icon: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> },
  warning: { container: 'bg-[#fbbf2410] border-[var(--warning)]/20 text-[var(--warning)]', icon: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> },
  error:   { container: 'bg-[#fb718510] border-[var(--error)]/20 text-[var(--error)]',  icon: <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> },
}

export function Alert({ variant = 'info', title, children, className }: {
  variant?: AlertVariant; title?: string; children: ReactNode; className?: string
}) {
  const { container, icon } = STYLES[variant]
  return (
    <div className={cn('flex gap-3 rounded-[10px] border p-3.5', container, className)} role="alert">
      {icon}
      <div className="text-sm">
        {title && <p className="font-medium mb-0.5">{title}</p>}
        <p className="opacity-90">{children}</p>
      </div>
    </div>
  )
}
