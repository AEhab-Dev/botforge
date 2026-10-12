import { HelpCircle, ExternalLink, Zap, Mail } from 'lucide-react'
import { Card, CardBody } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

// Brand icons not available in lucide-react 1.55+ — using inline SVGs
function IconGithub({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function IconDiscord({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

// Channel config uses React.FC icon components
type IconFC = ({ className }: { className?: string }) => React.ReactElement

const CHANNELS: {
  icon: IconFC
  label: string
  value: string
  description: string
  href: string
  badge: string
  badgeVariant: 'success' | 'purple' | 'mint' | 'info'
  primary: boolean
}[] = [
  {
    icon: ({ className }) => <Mail className={className} />,
    label: 'Email',
    value: 'support@botforge.io',
    description: 'For billing, account issues, or anything urgent.',
    href: 'mailto:support@botforge.io',
    badge: 'Replies within 24h',
    badgeVariant: 'success',
    primary: true,
  },
  {
    icon: IconGithub,
    label: 'GitHub',
    value: 'github.com/AEhab-Dev',
    description: 'Report bugs, request features, or browse the source.',
    href: 'https://github.com/AEhab-Dev',
    badge: 'Open source',
    badgeVariant: 'purple',
    primary: false,
  },
  {
    icon: IconInstagram,
    label: 'Instagram',
    value: '@botforge.io',
    description: 'Updates, tips, and behind-the-scenes content.',
    href: 'https://instagram.com/botforge.io',
    badge: 'Follow us',
    badgeVariant: 'mint',
    primary: false,
  },
  {
    icon: IconDiscord,
    label: 'Discord Community',
    value: 'discord.gg/botforge',
    description: 'Get help from the community and the team in real time.',
    href: 'https://discord.gg/botforge',
    badge: 'Fastest response',
    badgeVariant: 'info',
    primary: false,
  },
]

const FAQS = [
  {
    q: 'My bot token is showing as invalid.',
    a: 'Go to the Discord Developer Portal → your application → Bot tab → Reset Token. Copy the new token and paste it in BotForge. Make sure there are no extra spaces.',
  },
  {
    q: 'The bot is deployed but not responding in my server.',
    a: 'Check that: (1) the bot has been added to your server via the OAuth2 invite link, (2) Server Members Intent and Message Content Intent are enabled in the Developer Portal, (3) the bot has the correct channel permissions.',
  },
  {
    q: 'How do I add the bot to my Discord server?',
    a: 'Go to discord.com/developers/applications → your app → OAuth2 → URL Generator. Select the "bot" and "applications.commands" scopes, choose permissions, then use the generated URL to invite the bot.',
  },
  {
    q: 'Can I run multiple bots?',
    a: 'The Free plan supports 1 bot. Upgrade to Pro to run up to 5 bots simultaneously.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Billing → Cancel Plan. Your bot will remain active until the end of the billing period.',
  },
]

export default function SupportPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--purple-tint)] flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-[var(--purple-light)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Support</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] ml-12">
          We're here to help. Reach us through any of these channels.
        </p>
      </div>

      {/* Contact channels */}
      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map(({ icon: Icon, label, value, description, href, badge, badgeVariant, primary }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith('mailto') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className={[
              'group flex flex-col gap-3 p-5 rounded-[14px] border transition-all duration-150',
              primary
                ? 'border-[var(--purple)]/40 bg-[var(--purple-tint)] hover:border-[var(--purple)]/70'
                : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-raised)]',
            ].join(' ')}
          >
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-hover)] flex items-center justify-center">
                <Icon className="w-4 h-4 text-[var(--purple-light)]" />
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-[var(--text)]">{label}</p>
                <Badge variant={badgeVariant}>{badge}</Badge>
              </div>
              <p className="text-xs font-mono text-[var(--purple-light)] mb-1">{value}</p>
              <p className="text-xs text-[var(--text-muted)]">{description}</p>
            </div>
          </a>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <Card key={q}>
              <CardBody className="p-5">
                <p className="text-sm font-medium text-[var(--text)] mb-1.5">{q}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{a}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 p-4 rounded-[12px] bg-[var(--bg-card)] border border-[var(--border)]">
        <div className="w-8 h-8 rounded-[8px] bg-[var(--purple)] flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text)]">Built by a small team</p>
          <p className="text-xs text-[var(--text-muted)]">
            We read every message. Update the contact details above with your real info when you're ready.
          </p>
        </div>
      </div>
    </div>
  )
}
