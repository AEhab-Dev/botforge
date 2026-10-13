import { useQuery } from '@tanstack/react-query'
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react'
import { botsApi } from '../api/client'
import type { BotHealth } from '../api/client'

function fmtRelative(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function HealthDot({ health }: { health: BotHealth }) {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    healthy: {
      color: 'bg-[var(--success)]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />,
      label: 'Healthy',
    },
    degraded: {
      color: 'bg-[var(--warning)]',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />,
      label: 'Degraded',
    },
    error: {
      color: 'bg-[var(--error)]',
      icon: <XCircle className="w-3.5 h-3.5 text-[var(--error)]" />,
      label: 'Error',
    },
    unknown: {
      color: 'bg-[var(--text-muted)]',
      icon: <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />,
      label: 'Unknown',
    },
  }

  const state = map[health.healthStatus] ?? map.unknown

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5">
        {health.healthStatus === 'healthy' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${state.color} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${state.color}`} />
      </span>
      {state.icon}
      <span className="text-sm font-medium text-[var(--text)]">{state.label}</span>
    </div>
  )
}

interface Props {
  botId: string
}

export function BotHealthPanel({ botId }: Props) {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['health', botId],
    queryFn: () => botsApi.getHealth(botId),
    refetchInterval: 10_000,
    staleTime: 8_000,
  })

  const lastRefreshed = dataUpdatedAt
    ? fmtRelative(new Date(dataUpdatedAt).toISOString())
    : null

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]">
      {/* Live badge */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <Activity className="w-3 h-3 text-[var(--mint)]" />
        <span className="text-[var(--mint)] font-medium">Live</span>
      </div>

      <div className="w-px h-4 bg-[var(--border)]" />

      {isLoading || !data ? (
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--bg-hover)] animate-pulse" />
          <span className="text-sm text-[var(--text-muted)]">Checking…</span>
        </div>
      ) : (
        <HealthDot health={data} />
      )}

      {data?.lastErrorCode && (
        <>
          <div className="w-px h-4 bg-[var(--border)]" />
          <span className="text-xs text-[var(--error)] font-mono">{data.lastErrorCode}</span>
        </>
      )}

      {data?.lastHealthyAt && (
        <>
          <div className="w-px h-4 bg-[var(--border)]" />
          <span className="text-xs text-[var(--text-muted)]">
            Healthy {fmtRelative(data.lastHealthyAt)}
          </span>
        </>
      )}

      {lastRefreshed && (
        <span className="ml-auto text-xs text-[var(--text-muted)] hidden sm:block">
          Updated {lastRefreshed}
        </span>
      )}
    </div>
  )
}
