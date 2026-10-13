import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Bot, Zap, AlertCircle, RefreshCw } from 'lucide-react'
import { botsApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SkeletonCard } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Card } from '../components/ui/Card'
import type { Bot as BotType } from '../api/client'

function BotCard({ bot }: { bot: BotType }) {
  const qc = useQueryClient()
  const isActive = bot.status === 'running' || bot.status === 'deploying'

  const deploy = useMutation({
    mutationFn: () => botsApi.deploy(bot.id),
    onSuccess: () => { toast.success('Deployment queued'); qc.invalidateQueries({ queryKey: ['bots'] }) },
    onError: () => toast.error('Deploy failed — set a token and config first.'),
  })

  return (
    <Card className="flex flex-col hover:border-[var(--border-strong)] transition-colors">
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--purple-tint)] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[var(--purple-light)]" />
          </div>
          <StatusBadge status={bot.status} />
        </div>

        <h3 className="font-semibold text-[var(--text)] mb-1 truncate">{bot.name}</h3>
        {bot.description && (
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">{bot.description}</p>
        )}

        {bot.lastErrorCode && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--error)] mb-3">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {bot.lastErrorCode}
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)]">
          Updated {new Date(bot.updatedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center gap-2">
        <Link to={`/bots/${bot.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">Manage</Button>
        </Link>
        {!isActive && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            loading={deploy.isPending}
            onClick={() => deploy.mutate()}
            title="Deploy"
          />
        )}
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const { data, isLoading, error } = useQuery({
    queryKey: ['bots'],
    queryFn: () => botsApi.list(),
    refetchInterval: 8000,
  })
  const bots = data?.bots ?? []
  const running = bots.filter(b => b.status === 'running').length
  const needsAttention = bots.filter(b => b.status === 'error').length

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-[var(--text-muted)] mt-0.5">Here's an overview of your bots.</p>
        </div>
        <Link to="/bots/new">
          <Button icon={<Plus />}>Create bot</Button>
        </Link>
      </div>

      {/* Stats — only show if they have bots */}
      {bots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total bots', value: bots.length, color: 'var(--text)' },
            { label: 'Running', value: running, color: 'var(--success)' },
            { label: 'Need attention', value: needsAttention, color: needsAttention > 0 ? 'var(--error)' : 'var(--text-muted)' },
            { label: 'Stopped', value: bots.filter(b => b.status === 'stopped').length, color: 'var(--text-muted)' },
          ].map(stat => (
            <Card key={stat.label} className="p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Bot grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <Card className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-[var(--error)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">Failed to load bots. Try refreshing.</p>
        </Card>
      ) : bots.length === 0 ? (
        <EmptyState
          icon={<Zap />}
          title="Let's build your first bot"
          description="Describe what you need or start with a ready-made template. No coding required."
          action={
            <div className="flex gap-3">
              <Link to="/bots/new">
                <Button icon={<Plus />}>Build my bot</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Your bots</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map(bot => <BotCard key={bot.id} bot={bot} />)}
          </div>
        </div>
      )}
    </div>
  )
}
