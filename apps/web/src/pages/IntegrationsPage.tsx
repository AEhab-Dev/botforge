import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link2, ExternalLink } from 'lucide-react'
import { discordApi } from '../api/client'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

function IntegrationCard({
  logo,
  name,
  description,
  connected,
  comingSoon,
  onConnect,
  connecting,
}: {
  logo: React.ReactNode
  name: string
  description: string
  connected?: boolean
  comingSoon?: boolean
  onConnect?: () => void
  connecting?: boolean
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
              {logo}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--text)]">{name}</p>
                {comingSoon && <Badge variant="default">Coming Soon</Badge>}
                {connected && <Badge variant="success">Connected</Badge>}
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{description}</p>
            </div>
          </div>
          {!comingSoon && (
            <Button
              size="sm"
              variant={connected ? 'secondary' : 'primary'}
              onClick={onConnect}
              loading={connecting}
              disabled={connected}
              icon={connected ? undefined : <ExternalLink className="w-3.5 h-3.5" />}
            >
              {connected ? 'Connected' : 'Connect'}
            </Button>
          )}
          {comingSoon && (
            <Button size="sm" variant="secondary" disabled>
              Coming Soon
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default function IntegrationsPage() {
  const [connectingDiscord, setConnectingDiscord] = useState(false)

  async function handleDiscordConnect() {
    setConnectingDiscord(true)
    try {
      const { url } = await discordApi.getConnectUrl()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('Could not start Discord connection. Try again.')
    } finally {
      setConnectingDiscord(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Integrations</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Connect external services to unlock more bot features.</p>
      </div>

      <div className="space-y-3">
        <IntegrationCard
          logo={
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#5865F2] fill-current">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          }
          name="Discord"
          description="Connect your Discord account to select servers and install bots."
          onConnect={handleDiscordConnect}
          connecting={connectingDiscord}
        />

        <IntegrationCard
          logo={
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#9147FF]" aria-hidden="true">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
          }
          name="Twitch"
          description="Get notified when your Twitch streams go live."
          comingSoon
        />

        <IntegrationCard
          logo={
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#FF0000]">
              <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
            </svg>
          }
          name="YouTube"
          description="Announce new uploads and live streams automatically."
          comingSoon
        />
      </div>

      <Card className="bg-[var(--purple-tint)]/30 border-[var(--purple)]/20">
        <CardBody className="p-5">
          <div className="flex items-start gap-3">
            <Link2 className="w-5 h-5 text-[var(--purple-light)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--text)]">More integrations coming soon</p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Twitch and YouTube notifications will be available in an upcoming update.
                Connecting your Discord account above is required before deploying any bot.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
