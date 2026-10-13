import { useQuery } from '@tanstack/react-query'
import { useRef, useEffect, useState } from 'react'
import { Terminal, RefreshCw, AlertCircle } from 'lucide-react'
import { botsApi } from '../api/client'
import type { LogLine } from '../api/client'
import { Button } from './ui/Button'

interface Props {
  botId: string
  isRunning: boolean
}

function LogEntry({ line }: { line: LogLine }) {
  const isError = line.level === 'error'
  return (
    <div className={`flex gap-2 font-mono text-xs leading-relaxed py-0.5 ${
      isError ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'
    }`}>
      <span className={`shrink-0 select-none ${isError ? 'text-[var(--error)]/60' : 'text-[var(--text-muted)]'}`}>
        {isError ? 'ERR' : 'OUT'}
      </span>
      <span className="break-all">{line.message}</span>
    </div>
  )
}

export function BotLogsViewer({ botId, isRunning }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ['logs', botId],
    queryFn: () => botsApi.getLogs(botId),
    // Poll every 5s when running, every 30s otherwise
    refetchInterval: isRunning ? 5_000 : 30_000,
    staleTime: 4_000,
  })

  const logs = data?.logs ?? []

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, autoScroll])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <Terminal className="w-4 h-4 text-[var(--mint)]" />
        <span className="text-sm font-medium text-[var(--text)]">Logs</span>

        {isRunning && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            <span className="text-xs text-[var(--success)]">Live</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!autoScroll && logs.length > 0 && (
            <button
              onClick={() => {
                setAutoScroll(true)
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-xs text-[var(--purple-light)] hover:underline"
            >
              ↓ Jump to bottom
            </button>
          )}
          <Button
            variant="ghost"
            size="xs"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Log output */}
      <div
        className="h-72 overflow-y-auto p-4 space-y-0.5"
        onScroll={handleScroll}
      >
        {isLoading && (
          <div className="text-xs text-[var(--text-muted)] font-mono">Loading logs…</div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-[var(--error)]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Failed to load logs. Bot may not have been deployed yet.
          </div>
        )}

        {!isLoading && !error && logs.length === 0 && (
          <div className="text-xs text-[var(--text-muted)] font-mono">
            No logs available yet. Deploy the bot to see output here.
          </div>
        )}

        {logs.map((line, i) => (
          <LogEntry key={i} line={line} />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      {data && (
        <div className="px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)]">
            {logs.length} lines · last fetched {new Date(data.fetchedAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  )
}
