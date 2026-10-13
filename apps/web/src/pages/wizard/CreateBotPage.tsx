import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Zap, Bot, ArrowRight, ArrowLeft, Rocket, CheckCircle2 } from 'lucide-react'
import { botsApi } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Card } from '../../components/ui/Card'
import { Toggle } from '../../components/ui/Toggle'
import { StepIndicator } from '../../components/ui/StepIndicator'
import { Alert } from '../../components/ui/Alert'
import { WelcomeModuleEditor } from '../../components/modules/WelcomeModuleEditor'
import { AutoRoleModuleEditor } from '../../components/modules/AutoRoleModuleEditor'
import { ModerationModuleEditor } from '../../components/modules/ModerationModuleEditor'
import { CustomCommandsModuleEditor } from '../../components/modules/CustomCommandsModuleEditor'

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Describe' },
  { label: 'Modules' },
  { label: 'Configure' },
  { label: 'Connect' },
  { label: 'Deploy' },
]

// ─── Module metadata & defaults ───────────────────────────────────────────────

const MODULE_META: Record<string, { name: string; description: string; icon: string }> = {
  welcome:         { name: 'Welcome Messages',  description: 'Greet new members with a custom message and optional role.', icon: '👋' },
  auto_role:       { name: 'Auto-Role',          description: 'Automatically assign roles when someone joins.',            icon: '🎭' },
  custom_commands: { name: 'Custom Commands',    description: 'Create slash commands with text, embed, or link responses.', icon: '⚡' },
  moderation:      { name: 'Moderation',         description: 'Warn, timeout, kick, and ban with audit logging.',          icon: '🛡️' },
}

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  welcome: {
    channel_id: '',
    message_template: 'Welcome {user} to {server}!',
    auto_role_id: '',
    use_embed: false,
  },
  auto_role: { role_ids: [] },
  custom_commands: { commands: [] },
  moderation: {
    log_channel_id: '',
    warning_limit: 3,
    warning_action: 'timeout',
    timeout_duration_minutes: 60,
    anti_spam: true,
    anti_spam_threshold: 5,
  },
}

const EXAMPLE_PROMPTS = [
  'Welcome new members and assign them a role automatically',
  'Moderate my server with warnings, timeouts, and spam protection',
  'Create custom slash commands for my community',
  'Set up a complete moderation and welcome system',
]

function suggestModules(prompt: string): string[] {
  const p = prompt.toLowerCase()
  const out: string[] = []
  if (p.match(/welcom|greet|join|new member/)) out.push('welcome')
  if (p.match(/role|assign/)) out.push('auto_role')
  if (p.match(/command|slash|custom/)) out.push('custom_commands')
  if (p.match(/modera|warn|ban|kick|timeout|spam/)) out.push('moderation')
  return out.length ? out : ['welcome', 'custom_commands']
}

// ─── Module config state type ─────────────────────────────────────────────────

type ModuleConfigs = Record<string, Record<string, unknown>>

// ─── Step 1: Describe ─────────────────────────────────────────────────────────

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
        Continue
      </Button>
    </div>
  )
}

// ─── Step 2: Modules ──────────────────────────────────────────────────────────

function Step2Modules({ prompt, name, setName, description, setDescription, enabledModules, setEnabledModules, onNext, onBack }: {
  prompt: string; name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  enabledModules: string[]; setEnabledModules: (v: string[]) => void
  onNext: () => void; onBack: () => void
}) {
  const suggested = suggestModules(prompt)

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Name your bot & pick features</h2>
        <p className="text-[var(--text-muted)] mt-1.5">We've suggested features based on your description. Enable what you need.</p>
      </div>

      <div className="space-y-3">
        <Input label="Bot name" placeholder="My Community Bot" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Description (optional)" placeholder="What this bot does" value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">Features</p>
        <div className="space-y-2">
          {Object.entries(MODULE_META).map(([key, mod]) => {
            const isSuggested = suggested.includes(key)
            const isEnabled = enabledModules.includes(key)
            return (
              <Card key={key} className={`p-4 transition-all ${isEnabled ? 'border-[var(--purple)]/30 bg-[var(--purple-tint)]/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{mod.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text)]">{mod.name}</p>
                        {isSuggested && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--purple-tint)] text-[var(--purple-light)] border border-[var(--purple)]/20">
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
          Configure modules
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Configure modules ────────────────────────────────────────────────

function ModuleConfigEditor({ moduleKey, config, onChange }: {
  moduleKey: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  switch (moduleKey) {
    case 'welcome':
      return <WelcomeModuleEditor config={config as any} onChange={onChange} />
    case 'auto_role':
      return <AutoRoleModuleEditor config={config as any} onChange={onChange} />
    case 'moderation':
      return <ModerationModuleEditor config={config as any} onChange={onChange} />
    case 'custom_commands':
      return <CustomCommandsModuleEditor config={config as any} onChange={onChange} />
    default:
      return <p className="text-sm text-[var(--text-muted)] italic">No settings for this module.</p>
  }
}

function Step3Configure({ enabledModules, moduleConfigs, setModuleConfigs, onNext, onBack }: {
  enabledModules: string[]
  moduleConfigs: ModuleConfigs
  setModuleConfigs: (c: ModuleConfigs) => void
  onNext: () => void
  onBack: () => void
}) {
  const [activeModule, setActiveModule] = useState(enabledModules[0] ?? '')

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Configure your modules</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Set up each feature. You can always change these later.</p>
      </div>

      {/* Module tabs */}
      <div className="flex gap-2 flex-wrap">
        {enabledModules.map(key => (
          <button
            key={key}
            onClick={() => setActiveModule(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium transition-all ${
              activeModule === key
                ? 'bg-[var(--purple)] text-white'
                : 'bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text)] border border-[var(--border)]'
            }`}
          >
            <span>{MODULE_META[key]?.icon}</span>
            {MODULE_META[key]?.name ?? key}
          </button>
        ))}
      </div>

      {/* Active module editor */}
      {activeModule && (
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-[var(--text)]">{MODULE_META[activeModule]?.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{MODULE_META[activeModule]?.description}</p>
          </div>
          <ModuleConfigEditor
            moduleKey={activeModule}
            config={moduleConfigs[activeModule] ?? {}}
            onChange={config => setModuleConfigs({ ...moduleConfigs, [activeModule]: config })}
          />
        </Card>
      )}

      <Alert variant="info">
        Channel IDs and role IDs need Developer Mode enabled in Discord. Go to{' '}
        <strong>User Settings → Advanced → Developer Mode</strong>, then right-click any channel or role to copy its ID.
      </Alert>

      <div className="flex gap-3">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>Back</Button>
        <Button onClick={onNext} iconRight={<ArrowRight />} className="flex-1">
          Connect bot
        </Button>
      </div>
    </div>
  )
}

// ─── Step 4: Connect (token) ──────────────────────────────────────────────────

function Step4Connect({ name, token, setToken, onNext, onBack }: {
  name: string; token: string; setToken: (v: string) => void; onNext: () => void; onBack: () => void
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Connect your Discord bot</h2>
        <p className="text-[var(--text-muted)] mt-1.5">Add your bot token to connect <strong>{name}</strong> to Discord.</p>
      </div>

      <Alert variant="info" title="How to get a bot token">
        <ol className="list-decimal list-inside space-y-1 text-sm mt-1">
          <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="underline">discord.com/developers/applications</a></li>
          <li>Create a new application (or select an existing one)</li>
          <li>Go to <strong>Bot</strong> → click <strong>Reset Token</strong></li>
          <li>Enable <strong>Server Members Intent</strong> and <strong>Message Content Intent</strong></li>
          <li>Paste the token below</li>
        </ol>
      </Alert>

      <Input
        label="Bot token"
        type="password"
        placeholder="Paste your Discord bot token here"
        value={token}
        onChange={e => setToken(e.target.value)}
        hint="Stored encrypted at rest. Never shared or logged."
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

// ─── Step 5: Deploy ───────────────────────────────────────────────────────────

function Step5Deploy({ name, enabledModules, token, isDeploying, onCreate, onBack }: {
  name: string; enabledModules: string[]; token: string
  isDeploying: boolean; onCreate: () => void; onBack: () => void
}) {
  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text)]">Ready to {token ? 'deploy' : 'create'}</h2>
        <p className="text-[var(--text-muted)] mt-1.5">
          {token ? 'Your bot will go live on Discord immediately.' : 'You can add a token and deploy later.'}
        </p>
      </div>

      {/* Summary card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--purple-tint)] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[var(--purple-light)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">Discord bot · {enabledModules.length} module{enabledModules.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          {enabledModules.map(key => (
            <div key={key} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
              <span className="text-sm text-[var(--text-secondary)]">
                {MODULE_META[key]?.icon} {MODULE_META[key]?.name ?? key}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${token ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
            <span className="text-xs text-[var(--text-muted)]">
              {token ? 'Discord token connected' : 'No token — deploy after adding one'}
            </span>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>Back</Button>
        <Button onClick={onCreate} loading={isDeploying} icon={<Rocket />} className="flex-1">
          {token ? 'Create & deploy' : 'Create bot'}
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
  const [moduleConfigs, setModuleConfigs] = useState<ModuleConfigs>({})
  const [token, setToken] = useState('')

  // When modules are toggled, initialise their configs with defaults
  function handleSetEnabledModules(modules: string[]) {
    const configs = { ...moduleConfigs }
    for (const key of modules) {
      if (!configs[key]) {
        configs[key] = { ...(DEFAULT_CONFIGS[key] ?? {}) }
      }
    }
    setModuleConfigs(configs)
    setEnabledModules(modules)
  }

  const create = useMutation({
    mutationFn: async () => {
      // 1. Create bot
      const { bot } = await botsApi.create({ name: name.trim(), description: description.trim() || undefined })

      // 2. Set token if provided
      if (token.trim()) {
        await botsApi.setToken(bot.id, token.trim())
      }

      // 3. Save config with proper module defaults merged with user config
      const config = {
        schema_version: 1,
        name: bot.name,
        target_platform: 'discord',
        modules: enabledModules.map(key => ({
          module_key: key,
          enabled: true,
          config: {
            ...(DEFAULT_CONFIGS[key] ?? {}),
            ...(moduleConfigs[key] ?? {}),
          },
        })),
      }
      await botsApi.saveConfig(bot.id, config, 'Initial config from setup wizard')

      // 4. Deploy if token was provided
      if (token.trim()) {
        await botsApi.deploy(bot.id)
      }

      return bot
    },
    onSuccess: (bot) => {
      qc.invalidateQueries({ queryKey: ['bots'] })
      toast.success(token ? `${name} is deploying!` : `${name} created! Add a token to deploy.`)
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
      <div className="mb-8">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      {/* Steps */}
      {step === 0 && (
        <Step1Describe
          prompt={prompt}
          setPrompt={setPrompt}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <Step2Modules
          prompt={prompt}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          enabledModules={enabledModules}
          setEnabledModules={handleSetEnabledModules}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <Step3Configure
          enabledModules={enabledModules}
          moduleConfigs={moduleConfigs}
          setModuleConfigs={setModuleConfigs}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step4Connect
          name={name}
          token={token}
          setToken={setToken}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <Step5Deploy
          name={name}
          enabledModules={enabledModules}
          token={token}
          isDeploying={create.isPending}
          onCreate={() => create.mutate()}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  )
}
