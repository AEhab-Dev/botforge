import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Rocket, Square, Key, Settings2, RefreshCw,
  AlertCircle, Clock, CheckCircle2, XCircle, Bot, Ban
} from 'lucide-react'
import { botsApi } from '../api/client'
import type { Deployment } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'

// How long to keep polling before showing the "runtime not active" warning
const DEPLOY_TIMEOUT_MS = 20_000

function DeploymentRow({ d }: { d: Deployment }) {
  const statusIcon = {
    running:   <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />,
    stopped:   <Square className="w-4 h-4 text-[var(--text-muted)]" />,
    failed:    <XCircle className="w-4 h-4 text-[var(--error)]" />,
    queued:    <Clock className="w-4 h-4 text-[var(--warning)]" />,
    deploying: <RefreshCw className="w-4 h-4 text-[var(--warning)] animate-spin" />,
  }[d.status] ?? <Clock className="w-4 h-4 text-[var(--text-muted)]" />

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] capitalize">{d.status}</p>
        {d.errorSummary && (
          <p className="text-xs text-[var(--error)] truncate mt-0.5">{d.errorSummary}</p>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] shrink-0">
        {new Date(d.createdAt).toLocaleString()}
      </p>
    </div>
  )
}

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [tokenInput, setTokenInput] = useState('')
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Track how long we've been in a deploying/stopping state
  const [deployingElapsed, setDeployingElapsed] = useState(0)
  const deployTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deployTimerStartRef = useRef<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => botsApi.get(botId!),
    // Poll only while actively transitioning; stop after DEPLOY_TIMEOUT_MS
    refetchInterval: (q) => {
      const s = q.state.data?.bot.status
      if (s !== 'deploying' && s !== 'stopping') return 15000
      // Still poll, but the timer below will show the warning
      return 3000
    },
  })

  const { data: deployData } = useQuery({
    queryKey: ['deployments', botId],
    queryFn: () => botsApi.getDeployments(botId!),
    refetchInterval: 10000,
  })

  const bot = data?.bot
  const deploys = deployData?.deployments ?? []

  // Start/stop the elapsed timer when deploying state changes
  useEffect(() => {
    const isTransitioning = bot?.status === 'deploying' || bot?.status === 'stopping'

    if (isTransitioning) {
      if (deployTimerRef.current === null) {
        deployTimerStartRef.current = Date.now()
        deployTimerRef.current = setInterval(() => {
          setDeployingElapsed(Date.now() - (deployTimerStartRef.current ?? Date.now()))
        }, 1000)
      }
    } else {
      if (deployTimerRef.current !== null) {
        clearInterval(deployTimerRef.current)
        deployTimerRef.current = null
        deployTimerStartRef.current = null
        setDeployingElapsed(0)
      }
    }

    return () => {
      if (deployTimerRef.current !== null) {
        clearInterval(deployTimerRef.current)
        deployTimerRef.current = null
      }
    }
  }, [bot?.status])

  const deploy = useMutation({
    mutationFn: () => botsApi.deploy(botId!),
    onSuccess: () => {
      toast.success('Deploy queued!')
      qc.invalidateQueries({ queryKey: ['bot', botId] })
      qc.invalidateQueries({ queryKey: ['deployments', botId] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Deploy failed.'),
  })

  const stop = useMutation({
    mutationFn: () => botsApi.stop(botId!),
    onSuccess: () => {
      toast.success('Stop signal sent.')
      qc.invalidateQueries({ queryKey: ['bot', botId] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Stop failed.'),
  })

  const cancelDeployment = useMutation({
    mutationFn: () => botsApi.cancelDeployment(botId!),
    onSuccess: () => {
      toast.success('Deployment cancelled.')
      qc.invalidateQueries({ queryKey: ['bot', botId] })
      qc.invalidateQueries({ queryKey: ['deployments', botId] })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Cancel failed.'),
  })

  const setToken = useMutation({
    mutationFn: () => botsApi.setToken(botId!, tokenInput),
    onSuccess: () => {
      toast.success('Token saved — stored encrypted at rest.')
      setShowTokenModal(false)
      setTokenInput('')
      qc.invalidateQueries({ queryKey: ['bot', botId] })
    },
    onError: () => toast.error('Failed to save token.'),
  })

  const deleteBot = useMutation({
    mutationFn: () => botsApi.delete(botId!),
    onSuccess: () => {
      toast.success('Bot deleted.')
      qc.invalidateQueries({ queryKey: ['bots'] })
      navigate('/bots')
    },
    onError: () => toast.error('Failed to delete bot.'),
  })

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-8 h-8 text-[var(--error)] mx-auto mb-3" />
        <p className="text-[var(--text-secondary)]">Bot not found.</p>
        <Link to="/bots" className="mt-4 inline-block">
          <Button variant="secondary" icon={<ArrowLeft />}>Back to bots</Button>
        </Link>
      </div>
    )
  }

  const isRunning    = bot.status === 'running'
  const isDeploying  = bot.status === 'deploying'
  const isStopping   = bot.status === 'stopping'
  const isTransiting = isDeploying || isStopping
  const hasToken     = !!bot.discordBotTokenEncrypted
  const deployTimedOut = deployingElapsed >= DEPLOY_TIMEOUT_MS

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/bots">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>Bots</Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--purple-tint)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[var(--purple-light)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]">{bot.name}</h1>
              <StatusBadge status={bot.status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link to={`/bots/${botId}/config`}>
            <Button variant="secondary" size="sm" icon={<Settings2 />}>Configure</Button>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            icon={<Key />}
            onClick={() => setShowTokenModal(true)}
          >
            {hasToken ? 'Update token' : 'Set token'}
          </Button>

          {/* Action button — context-sensitive */}
          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              icon={<Square />}
              loading={stop.isPending}
              onClick={() => stop.mutate()}
            >
              Stop
            </Button>
          )}
          {isTransiting && (
            <Button
              variant="danger"
              size="sm"
              icon={<Ban />}
              loading={cancelDeployment.isPending}
              onClick={() => cancelDeployment.mutate()}
            >
              Cancel
            </Button>
          )}
          {!isRunning && !isTransiting && (
            <Button
              size="sm"
              icon={<Rocket />}
              loading={deploy.isPending}
              onClick={() => deploy.mutate()}
            >
              Deploy
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {!hasToken && (
        <Alert variant="warning" title="No Discord token">
          Add a bot token before deploying. Get one from the{' '}
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Discord Developer Portal
          </a>.
        </Alert>
      )}

      {/* Deployment timeout warning */}
      {isDeploying && deployTimedOut && (
        <Alert variant="warning" title="Runtime worker not active">
          The bot has been queued for over {Math.floor(DEPLOY_TIMEOUT_MS / 1000)}s but no runtime
          worker is running — this is a preview environment without a live bot runtime. Click{' '}
          <strong>Cancel</strong> to reset, or wait if you're starting the runtime worker now.
        </Alert>
      )}

      {/* Deploying spinner info */}
      {isDeploying && !deployTimedOut && (
        <Alert variant="info" title="Deploying…">
          Your bot is being deployed. This usually takes a few seconds.
          {deployingElapsed > 5000 && ' Still waiting — checking for a running worker.'}
        </Alert>
      )}

      {bot.status === 'error' && bot.lastErrorCode && (
        <Alert variant="error" title={`Error: ${bot.lastErrorCode}`}>
          Check the deployment history for details. Fix the issue and redeploy.
        </Alert>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text)]">Bot details</h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Status</span>
              <StatusBadge status={bot.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Platform</span>
              <span className="text-[var(--text)] capitalize">{bot.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Token</span>
              <span className={hasToken ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
                {hasToken ? '✓ Set' : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Guild ID</span>
              <span className="text-[var(--text)] font-mono text-xs">
                {bot.discordGuildId ?? <span className="text-[var(--text-muted)]">—</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Created</span>
              <span className="text-[var(--text)]">{new Date(bot.createdAt).toLocaleDateString()}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text)]">Deployment history</h2>
          </CardHeader>
          <CardBody>
            {deploys.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">No deployments yet.</p>
            ) : (
              deploys.slice(0, 5).map(d => <DeploymentRow key={d.id} d={d} />)
            )}
          </CardBody>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="border-[var(--error)]/20">
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--error)]">Danger zone</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text)]">Delete this bot</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Removes all configuration, deployments, and history permanently.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Token modal */}
      <Modal
        open={showTokenModal}
        onClose={() => { setShowTokenModal(false); setTokenInput('') }}
        title="Discord Bot Token"
        description="Stored encrypted at rest. Never logged or exposed."
      >
        <div className="space-y-4">
          <Input
            label="Bot token"
            type="password"
            placeholder="Paste your token from Discord Developer Portal"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => { setShowTokenModal(false); setTokenInput('') }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              loading={setToken.isPending}
              disabled={!tokenInput.trim()}
              onClick={() => setToken.mutate()}
              className="flex-1"
            >
              Save token
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete bot"
        description="This will permanently delete the bot and all its configuration. This cannot be undone."
      >
        <div className="space-y-4">
          <Alert variant="error">
            All deployments, configurations, and history will be permanently deleted.
          </Alert>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteBot.isPending}
              onClick={() => deleteBot.mutate()}
              className="flex-1"
            >
              Delete bot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
