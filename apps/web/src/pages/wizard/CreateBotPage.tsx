import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Zap, Bot, ArrowRight, ArrowLeft, Rocket } from 'lucide-react'
import { botsApi } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { StepIndicator } from '../../components/ui/StepIndicator'
import { Alert } from '../../components/ui/Alert'

// ─── Step data ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Describe' },
  { label: 'Customize' },
  { label: 'Configure' },
  { label: 'Deploy' },
]

const EXAMPLE_PROMPTS = [
  'Welcome new members and assign them a role automatically',
  'Moderate my server with warnings, timeouts, and spam protection',
  'Create custom slash commands for my community',
  'Announce when my Twitch stream goes live',
]

const MODULE_DESCRIPTIONS: Record<string, { name: string; description: string; icon: string }> = {
  welcome:          { name: 'Welcome Messages',  description: 'Greet new members with a custom message and optional role.', icon: '👋' },
  auto_role:        { name: 'Auto-Role',          description: 'Automatically assign roles when someone joins.', icon: '🎭' },
  custom_commands:  { name: 'Custom Commands',    description: 'Create slash commands with text, embed, or link responses.', icon: '⚡' },
  moderation:       { name: 'Moderation',         description: 'Warn, timeout, kick, and ban with audit logging.', icon: '🛡️' },
}

// Very simple NLP — map prompt keywords to modules
function suggestModules(prompt: string): string[] {
  const p = prompt.toLowerCase()
  const out: string[] = []
  if (p.match(/welcom|greet|join|new member/)) out.push('welcome')
  if (p.match(/role|assign/)) out.push('auto_role')
  if (p.match(/command|slash|custom/)) out.push('custom_commands')
  if (p.match(/modera|warn|ban|kick|timeout|spam/)) out.push('moderation')
  return out.length ? out : ['welcome', 'custom_commands']
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1Describe({ prompt, setPrompt, onNext }: {
  prompt: string; setPrompt: (v: string) => void; onNext: () => void
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">What should your bot do?</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Describe your idea in plain English. No technical knowledge needed.</p>
      </div>

      <Textarea
        label="Describe your bot"
        placeholder="e.g. I want a bot that welcomes new members, assigns a Member role, and lets me create custom commands for my community."
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        className="min-h-[140px]"
      />

      <div>
        <p className="text-xs text-[var(--text-muted)] mb-2">Or try an example:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map(ex => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--purple)] hover:text-[var(--purple-light)] transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={onNext}
        disabled={prompt.trim().length < 10}
        iconRight={<ArrowRight />}
        className="w-full"
      >
        Build my bot
      </Button>
    </div>
  )
}

function Step2Customize({ prompt, name, setName, description, setDescription, enabledModules, setEnabledModules, onNext, onBack }: {
  prompt: string; name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  enabledModules: string[]; setEnabledModules: (v: string[]) => void
  onNext: () => void; onBack: () => void
}) {
  const suggested = suggestModules(prompt)

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Here's what your bot will do</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Based on your description, we've suggested some features. Enable what you need.</p>
      </div>

      <div className="space-y-3">
        <Input label="Bot name" placeholder="My Community Bot" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Description (optional)" placeholder="What this bot does" value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Features</p>
        <div className="space-y-2">
          {Object.entries(MODULE_DESCRIPTIONS).map(([key, mod]) => {
            const isSuggested = suggested.includes(key)
            const isEnabled = enabledModules.includes(key)
            return (
              <Card key={key} className={`p-4 transition-colors ${isEnabled ? 'border-[var(--purple)]/30 bg-[var(--purple-tint)]/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5">{mod.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text)]">{mod.name}</p>
                        {isSuggested && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--purple-tint)] text-[var(--purple-light)] font-medium">
                            Suggested
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{mod.description}</p>
                    </div>
                  </div>
                  <Toggle
                    size="sm"
                    checked={isEnabled}
                    onChange={v => setEnabledModules(
                      v ? [...enabledModules, key] : enabledModules.filter(k => k !== key)
                    )}
                  />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>Back</Button>
        <Button onClick={onNext} disabled={!name.trim() || enabledModules.length === 0} iconRight={<ArrowRight />} className="flex-1">
          Continue
        </Button>
      </div>
    </div>
  )
}

function Step3Configure({ name, token, setToken, onNext, onBack }: {
  name: string; token: string; setToken: (v: string) => void; onNext: () => void; onBack: () => void
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Connect your Discord bot</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Add your Discord bot token to get {name} running in your server.</p>
      </div>

      <Alert variant="info" title="Where do I get a token?">
        Go to{' '}
        <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline">
          discord.com/developers/applications
        </a>
        {' '}→ New Application → Bot → Reset Token.
      </Alert>

      <Input
        label="Bot token"
        type="password"
        placeholder="Paste your Discord bot token"
        value={token}
        onChange={e => setToken(e.target.value)}
        hint="Stored encrypted at rest. Never shared."
      />

      <div className="flex gap-3">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>Back</Button>
        <Button onClick={onNext} iconRight={<ArrowRight />} className="flex-1">
          {token.trim() ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  )
}

function Step4Deploy({ name, isDeploying, onCreate, onBack }: {
  name: string; isDeploying: boolean; onCreate: () => void; onBack: () => void
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Ready to deploy</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Review your bot and click deploy to go live.</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--purple-tint)] flex items-center justify-center">
            <Bot className="w-5 h-5 text-[var(--purple-light)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">Discord bot</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>Back</Button>
        <Button onClick={onCreate} loading={isDeploying} icon={<Rocket />} className="flex-1">
          Create &amp; deploy
        </Button>
      </div>
    </div>
  )
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function CreateBotPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [token, setToken] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      // 1. Create bot
      const { bot } = await botsApi.create({ name: name.trim(), description: description.trim() || undefined })

      // 2. Set token if provided
      if (token.trim()) {
        await botsApi.setToken(bot.id, token.trim())
      }

      // 3. Save initial config
      const config = {
        schema_version: 1,
        name: bot.name,
        target_platform: 'discord',
        modules: enabledModules.map(key => ({
          module_key: key,
          enabled: true,
          config: {},
        })),
      }
      await botsApi.saveConfig(bot.id, config, `Initial config from wizard`)

      // 4. Deploy if we have a token
      if (token.trim()) {
        await botsApi.deploy(bot.id)
      }

      return bot
    },
    onSuccess: (bot) => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      toast.success(token ? `${name} deployed!` : `${name} created! Add a token to deploy.`)
      navigate(`/bots/${bot.id}`)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Failed to create bot. Please try again.')
    },
  })

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-lg font-bold text-[var(--text)]">Create Bot</h1>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center mb-10">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      {/* Step content */}
      {step === 0 && (
        <Step1Describe
          prompt={prompt}
          setPrompt={setPrompt}
          onNext={() => {
            setEnabledModules(suggestModules(prompt))
            setStep(1)
          }}
        />
      )}
      {step === 1 && (
        <Step2Customize
          prompt={prompt}
          name={name} setName={setName}
          description={description} setDescription={setDescription}
          enabledModules={enabledModules} setEnabledModules={setEnabledModules}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <Step3Configure
          name={name}
          token={token} setToken={setToken}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step4Deploy
          name={name}
          isDeploying={create.isPending}
          onCreate={() => create.mutate()}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  )
}
