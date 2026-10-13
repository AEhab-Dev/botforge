import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Rocket, ChevronDown, ChevronUp } from 'lucide-react'
import { botsApi, modulesApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Toggle } from '../components/ui/Toggle'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'
import { WelcomeModuleEditor } from '../components/modules/WelcomeModuleEditor'
import { AutoRoleModuleEditor } from '../components/modules/AutoRoleModuleEditor'
import { ModerationModuleEditor } from '../components/modules/ModerationModuleEditor'
import { CustomCommandsModuleEditor } from '../components/modules/CustomCommandsModuleEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleInstance {
  module_key: string
  enabled: boolean
  config: Record<string, unknown>
}

interface BotSpec {
  schema_version: number
  name: string
  target_platform: string
  modules: ModuleInstance[]
}

// ─── Module metadata ──────────────────────────────────────────────────────────

const MODULE_META: Record<string, { name: string; description: string; icon: string }> = {
  welcome:         { name: 'Welcome Messages',  description: 'Greet new members with a custom message', icon: '👋' },
  auto_role:       { name: 'Auto-Role',          description: 'Assign roles when members join',          icon: '🎭' },
  custom_commands: { name: 'Custom Commands',    description: 'Create custom slash commands',             icon: '⚡' },
  moderation:      { name: 'Moderation',         description: 'Warn, timeout, kick, and ban members',    icon: '🛡️' },
}

// ─── Default configs ──────────────────────────────────────────────────────────

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

// ─── Module-specific editor dispatcher ───────────────────────────────────────

function ModuleEditor({ mod, onChange }: { mod: ModuleInstance; onChange: (m: ModuleInstance) => void }) {
  function updateConfig(config: Record<string, unknown>) {
    onChange({ ...mod, config })
  }

  switch (mod.module_key) {
    case 'welcome':
      return <WelcomeModuleEditor config={mod.config as any} onChange={updateConfig} />
    case 'auto_role':
      return <AutoRoleModuleEditor config={mod.config as any} onChange={updateConfig} />
    case 'moderation':
      return <ModerationModuleEditor config={mod.config as any} onChange={updateConfig} />
    case 'custom_commands':
      return <CustomCommandsModuleEditor config={mod.config as any} onChange={updateConfig} />
    default:
      return (
        <p className="text-sm text-[var(--text-muted)] italic">
          No configuration available for this module.
        </p>
      )
  }
}

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({ mod, onChange }: { mod: ModuleInstance; onChange: (m: ModuleInstance) => void }) {
  const [expanded, setExpanded] = useState(false)
  const meta = MODULE_META[mod.module_key]

  return (
    <Card className={mod.enabled ? 'border-[var(--purple)]/30' : ''}>
      {/* Header row */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xl shrink-0" aria-hidden>{meta?.icon ?? '🔧'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text)]">{meta?.name ?? mod.module_key}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{meta?.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Toggle
            size="sm"
            checked={mod.enabled}
            onChange={v => onChange({ ...mod, enabled: v })}
          />
          {mod.enabled && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1"
              aria-label={expanded ? 'Collapse settings' : 'Expand settings'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Config panel */}
      {mod.enabled && expanded && (
        <div className="border-t border-[var(--border)] px-5 py-5">
          <ModuleEditor mod={mod} onChange={onChange} />
        </div>
      )}

      {/* Hint when enabled but collapsed */}
      {mod.enabled && !expanded && (
        <div className="border-t border-[var(--border)] px-5 py-2.5">
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-[var(--purple-light)] hover:text-[var(--purple)] transition-colors"
          >
            Configure settings →
          </button>
        </div>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BotConfigPage() {
  const { botId } = useParams<{ botId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [spec, setSpec] = useState<BotSpec | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const { data: botData } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => botsApi.get(botId!),
  })

  const { data: revisionsData } = useQuery({
    queryKey: ['revisions', botId],
    queryFn: () => botsApi.getRevisions(botId!),
  })

  const { data: modulesData } = useQuery({
    queryKey: ['modules'],
    queryFn: () => modulesApi.list(),
  })

  // Initialise spec from latest active revision or build a blank one
  useEffect(() => {
    if (!botData?.bot || spec) return

    const active = revisionsData?.revisions?.find(r => r.isActive)
    if (active?.configuration && typeof active.configuration === 'object') {
      setSpec(active.configuration as BotSpec)
      return
    }

    // Build blank spec from available modules
    const available = modulesData?.modules ?? []
    const modules: ModuleInstance[] = available.map(m => ({
      module_key: m.moduleKey,
      enabled: false,
      config: { ...(DEFAULT_CONFIGS[m.moduleKey] ?? {}) },
    }))

    // Fallback to known modules if API returned nothing
    if (modules.length === 0) {
      Object.keys(DEFAULT_CONFIGS).forEach(key => {
        modules.push({ module_key: key, enabled: false, config: { ...DEFAULT_CONFIGS[key] } })
      })
    }

    setSpec({
      schema_version: 1,
      name: botData.bot.name,
      target_platform: 'discord',
      modules,
    })
  }, [botData, revisionsData, modulesData, spec])

  const save = useMutation({
    mutationFn: () => botsApi.saveConfig(botId!, spec!, 'Manual config update'),
    onSuccess: () => {
      toast.success('Configuration saved.')
      setIsDirty(false)
      qc.invalidateQueries({ queryKey: ['revisions', botId] })
    },
    onError: () => toast.error('Failed to save configuration.'),
  })

  const deploy = useMutation({
    mutationFn: async () => {
      await botsApi.saveConfig(botId!, spec!, 'Config saved and deployed')
      return botsApi.deploy(botId!)
    },
    onSuccess: () => {
      toast.success('Bot deployed!')
      setIsDirty(false)
      qc.invalidateQueries({ queryKey: ['bot', botId] })
      navigate(`/bots/${botId}`)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Deploy failed.'),
  })

  function updateModule(index: number, updated: ModuleInstance) {
    if (!spec) return
    const modules = [...spec.modules]
    modules[index] = updated
    setSpec({ ...spec, modules })
    setIsDirty(true)
  }

  if (!spec) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const enabledCount = spec.modules.filter(m => m.enabled).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/bots/${botId}`}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft />}>
              {botData?.bot.name ?? 'Bot'}
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Configure</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {enabledCount} module{enabledCount !== 1 ? 's' : ''} enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Save className="w-4 h-4" />}
            loading={save.isPending}
            disabled={!isDirty || deploy.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
          <Button
            size="sm"
            icon={<Rocket className="w-4 h-4" />}
            loading={deploy.isPending}
            disabled={save.isPending}
            onClick={() => deploy.mutate()}
          >
            Save & deploy
          </Button>
        </div>
      </div>

      {isDirty && (
        <Alert variant="warning">You have unsaved changes — save or deploy to keep them.</Alert>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {spec.modules.map((mod, i) => (
          <ModuleCard key={mod.module_key} mod={mod} onChange={u => updateModule(i, u)} />
        ))}
      </div>

      {enabledCount === 0 && (
        <p className="text-center text-sm text-[var(--text-muted)] py-4">
          Enable at least one module to deploy your bot.
        </p>
      )}
    </div>
  )
}
