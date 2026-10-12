import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Bot, AlertCircle, Search, RefreshCw } from 'lucide-react'
import { botsApi } from '../api/client'
import type { Bot as BotType } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { StatusBadge } from '../components/ui/StatusBadge'
import { SkeletonCard } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { Card } from '../components/ui/Card'

function BotCard({ bot }: { bot: BotType }) {
  const qc = useQueryClient()
  const deploy = useMutation({
    mutationFn: () => botsApi.deploy(bot.id),
    onSuccess: () => { toast.success('Deployment queued'); qc.invalidateQueries({ queryKey: ['bots'] }) },
    onError: () => toast.error('Deploy failed — configure your bot first.'),
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
          <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-2">{bot.description}</p>
        )}
        {bot.lastErrorCode && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--error)] mb-2">
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
          <Button variant="secondary" size="sm" className="w-full">Open</Button>
        </Link>
        {bot.status !== 'running' && bot.status !== 'deploying' && (
          <Button
            size="sm" variant="ghost"
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

export default function BotsPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: () => botsApi.list(),
    refetchInterval: 8000,
  })

  const bots = (data?.bots ?? []).filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">My Bots</h1>
          <p className="text-[var(--text-muted)] mt-0.5">Manage your Discord bots.</p>
        </div>
        <Link to="/bots/new">
          <Button icon={<Plus />}>Create bot</Button>
        </Link>
      </div>

      {(data?.bots?.length ?? 0) > 0 && (
        <div className="max-w-xs">
          <Input
            placeholder="Search bots…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : bots.length === 0 ? (
        <EmptyState
          icon={<Bot />}
          title={search ? 'No bots match your search' : "No bots yet"}
          description={search ? 'Try a different search term.' : 'Create your first bot to get started.'}
          action={!search ? (
            <Link to="/bots/new"><Button icon={<Plus />}>Create bot</Button></Link>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map(bot => <BotCard key={bot.id} bot={bot} />)}
        </div>
      )}
    </div>
  )
}
