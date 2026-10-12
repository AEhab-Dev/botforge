import { BookOpen, ExternalLink, Zap, Bot, Settings2, Shield, MessageSquare, Hash } from 'lucide-react'
import { Card, CardBody } from '../components/ui/Card'

const SECTIONS = [
  {
    icon: Zap,
    title: 'Getting Started',
    description: 'Create your first bot in under 5 minutes.',
    steps: [
      'Create an account and log in.',
      'Click "Create Bot" in the sidebar.',
      'Give your bot a name and description.',
      'Go to the Discord Developer Portal and create a new application.',
      'Copy your bot token and paste it into BotForge.',
      'Enable the modules you want (Welcome, Moderation, etc.).',
      'Click Deploy — your bot goes live instantly.',
    ],
  },
  {
    icon: Bot,
    title: 'Modules',
    description: 'Each module adds a feature to your bot. Mix and match.',
    items: [
      { name: 'Welcome Messages', desc: 'Greet new members with a custom message in any channel.' },
      { name: 'Auto-Role',        desc: 'Automatically assign roles when a member joins your server.' },
      { name: 'Custom Commands',  desc: 'Create slash commands that reply with text, embeds, or links.' },
      { name: 'Moderation',       desc: 'Warn, timeout, kick, and ban members. Logs all actions.' },
    ],
  },
  {
    icon: Settings2,
    title: 'Bot Token',
    description: 'Your bot token is required to connect BotForge to Discord.',
    steps: [
      'Go to discord.com/developers/applications.',
      'Select your application → Bot tab.',
      'Click "Reset Token" and copy it.',
      'In BotForge, open your bot → paste the token in the Token field.',
      'Never share your token publicly.',
    ],
  },
  {
    icon: Shield,
    title: 'Permissions & Intents',
    description: 'Your bot needs the right permissions to work correctly.',
    steps: [
      'In the Discord Developer Portal → OAuth2 → URL Generator.',
      'Select scopes: bot, applications.commands.',
      'Select permissions: Manage Roles, Kick Members, Ban Members, Manage Messages, Send Messages, Read Message History.',
      'Enable Privileged Intents: Server Members Intent, Message Content Intent.',
      'Use the generated URL to add the bot to your server.',
    ],
  },
]

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--purple-tint)] flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[var(--purple-light)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Documentation</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] ml-12">
          Everything you need to set up and run your Discord bot.
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Discord Dev Portal', href: 'https://discord.com/developers/applications', icon: ExternalLink },
          { label: 'Discord.js Docs',    href: 'https://discord.js.org',                     icon: ExternalLink },
          { label: 'Bot Permissions',    href: 'https://discordapi.com/permissions.html',     icon: ExternalLink },
          { label: 'Bot Invite Guide',   href: 'https://discord.com/developers/docs/topics/oauth2', icon: ExternalLink },
        ].map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-raised)] transition-all"
          >
            <Icon className="w-3.5 h-3.5 shrink-0 text-[var(--purple-light)]" />
            {label}
          </a>
        ))}
      </div>

      {/* Sections */}
      {SECTIONS.map(({ icon: Icon, title, description, steps, items }) => (
        <Card key={title}>
          <CardBody className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[var(--bg-hover)] flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-[var(--purple-light)]" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--text)]">{title}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">{description}</p>
              </div>
            </div>

            {steps && (
              <ol className="space-y-2 ml-11">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--text-secondary)]">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[10px] font-bold text-[var(--purple-light)] mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}

            {items && (
              <div className="space-y-2 ml-11">
                {items.map(({ name, desc }) => (
                  <div key={name} className="flex items-start gap-2">
                    <Hash className="w-3.5 h-3.5 text-[var(--purple-light)] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-[var(--text)]">{name}</span>
                      <span className="text-sm text-[var(--text-muted)]"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ))}

      {/* Footer note */}
      <p className="text-xs text-[var(--text-muted)] text-center pb-4">
        More guides coming soon. Need help?{' '}
        <a href="/support" className="text-[var(--purple-light)] hover:underline">Contact support →</a>
      </p>
    </div>
  )
}
