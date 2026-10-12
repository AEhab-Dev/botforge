import { cn } from '../../lib/utils'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className={cn(
        'relative z-10 w-full rounded-[16px] border border-[var(--border)] bg-[var(--bg-raised)] shadow-2xl animate-fade-in',
        size === 'sm' && 'max-w-sm',
        size === 'md' && 'max-w-md',
        size === 'lg' && 'max-w-2xl',
        className
      )}>
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--border)]">
            <div>
              {title && <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>}
              {description && <p className="text-sm text-[var(--text-muted)] mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-hover)]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
