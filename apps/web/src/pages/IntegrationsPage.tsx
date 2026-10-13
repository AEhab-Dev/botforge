import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ExternalLink, Unlink, CheckCircle2 } from 'lucide-react'
import { discordApi } from '../api/client'
import { Card, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'

// ─── Discord logo SVG ─────────────────────────────────────────────────────────

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#5865F2] fill-current" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  )
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  logo, name, description, connected, comingSoon,
  connectedLabel, onConnect, onDisconnect, connecting, disconnecting,
}: {
  logo: React.ReactNode
  name: string
  description: string
  connected?: boolean
  comingSoon?: boolean
  connectedLabel?: string
  onConnect?: () => void
  onDisconnect?: () => void
  connecting?: boolean
  disconnecting?: boolean
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
              {logo}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[var(--text)]">{name}</p>
                {comingSoon && <Badge variant="default">Coming Soon</Badge>}
                {connected && (
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                    Connected
                  </Badge>
                )}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{description}</p>
              {connected && connectedLabel && (
                <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                  {connectedLabel}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {comingSoon && (
              <Button size="sm" variant="secondary" disabled>Coming Soon</Button>
            )}
            {!comingSoon && !connected && (
              <Button
                size="sm"
                loading={connecting}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={onConnect}
              >
                Connect
              </Button>
            )}
            {!comingSoon && connected && (
              <Button
                size="sm"
                variant="danger"
                loading={disconnecting}
                icon={<Unlink className="w-3.5 h-3.5" />}
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()

  // Handle Discord OAuth callback redirects
  useEffect(() => {
    const success = params.get('success')
    const error   = params.get('error')
    const username = params.get('username')

    if (success === 'discord_connected') {
      toast.success(`Discord connected${username ? ` as @${username}` : ''}!`)
      qc.invalidateQueries({ queryKey: ['discord-status'] })
      setParams({}, { replace: true })
    } else if (error === 'discord_denied') {
      toast('Discord authorization was denied.', { icon: 'ℹ️' })
      setParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['discord-status'],
    queryFn: discordApi.getStatus,
    staleTime: 30_000,
  })

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { url } = await discordApi.getConnectUrl()
      // Redirect in same tab so cookie is preserved
      window.location.href = url
    },
    onError: () => toast.error('Could not start Discord connection. Try again.'),
  })

  const disconnectMutation = useMutation({
    mutationFn: discordApi.disconnect,
    onSuccess: () => {
      toast.success('Discord account disconnected.')
      qc.invalidateQueries({ queryKey: ['discord-status'] })
    },
    onError: () => toast.error('Failed to disconnect Discord.'),
  })

  const isConnected = statusData?.connected === true

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Integrations</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Connect external services to unlock more bot features.
        </p>
      </div>

      {statusData?.reason && !isConnected && (
        <Alert variant="warning">
          Discord disconnected: {statusData.reason}
        </Alert>
      )}

      <div className="space-y-3">
        {/* Discord */}
        <IntegrationCard
          logo={<DiscordLogo />}
          name="Discord"
          description="Connect your Discord account to select servers and manage bots directly."
          connected={isConnected}
          connectedLabel={statusLoading ? 'Checking…' : isConnected ? 'Your Discord account is linked' : undefined}
          connecting={connectMutation.isPending}
          disconnecting={disconnectMutation.isPending}
          onConnect={() => connectMutation.mutate()}
          onDisconnect={() => disconnectMutation.mutate()}
        />

        {/* Twitch — coming soon */}
        <IntegrationCard
          logo={
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#9147FF]" aria-hidden>
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
          }
          name="Twitch"
          description="Respond to Twitch chat events and stream alerts."
          comingSoon
        />

        {/* Slack — coming soon */}
        <IntegrationCard
          logo={
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
              <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z"/>
              <path fill="#E01E5A" d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
              <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z"/>
              <path fill="#36C5F0" d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
              <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z"/>
              <path fill="#2EB67D" d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
              <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z"/>
              <path fill="#ECB22E" d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
            </svg>
          }
          name="Slack"
          description="Deploy bots to Slack workspaces and respond to messages."
          comingSoon
        />
      </div>
    </div>
  )
}
