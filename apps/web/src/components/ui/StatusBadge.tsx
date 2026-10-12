import { Badge } from './Badge'
import type { Bot } from '../../api/client'

const STATUS_MAP: Record<Bot['status'], { variant: 'default' | 'purple' | 'success' | 'warning' | 'error' | 'info' | 'mint', label: string, pulse?: boolean }> = {
  draft:     { variant: 'default',  label: 'Draft' },
  deploying: { variant: 'warning',  label: 'Deploying', pulse: true },
  running:   { variant: 'success',  label: 'Running' },
  stopping:  { variant: 'warning',  label: 'Stopping', pulse: true },
  stopped:   { variant: 'default',  label: 'Stopped' },
  error:     { variant: 'error',    label: 'Error' },
  deleted:   { variant: 'default',  label: 'Deleted' },
}

export function StatusBadge({ status, className }: { status: Bot['status']; className?: string }) {
  const { variant, label, pulse } = STATUS_MAP[status] ?? STATUS_MAP.error
  return <Badge variant={variant} dot pulse={pulse} className={className}>{label}</Badge>
}
