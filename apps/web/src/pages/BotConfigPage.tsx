import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { botsApi, modulesApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Toggle } from '../components/ui/Toggle'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'

// ─── Default configs ───────────────────────────────────────────────────────────

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

const MODULE_LABELS: Record<string, { name: string; description: string }> = {
  welcome:         { name: 'Welcome Messages',  description: 'Greet new members with a custom message' },
  auto_role:       { name: 'Auto-Role',          description: 'Assign roles when members join' },
  custom_commands: { name: 'Custom Commands',    description: 'Create slash commands' },
  moderation:      { name: 'Moderation',         description: 'Warn, timeout, kick, and ban members' },
}

// ─── Field editor ─────────────────────────────────────────────────────────────

function ConfigField({ label, fieldKey, value, onChange }: {
  label: string; fieldKey: string; value: unknown; onChange: (v: unknown) => void
}) {
  if (typeof value === 'boolean') {
    return (
      <Toggle
        label={label}
        checked={value}
        onChange={onChange}
      />
    )
  }
  if (typeof value === 'number') {
    return (
      <Input
        label={label}
        type="number"
        value={String(value)}
        onChange={e => onChange(Number(e.target.value))}
      />
    )
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
        {value.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={String(item)}
              onChange={e => {
                const next = [...value]
                next[i] = e.target.value
                onChange(next)
              }}
              className="flex-1"
            />
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label="Remove"
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => onChange([...value, ''])}
        >
          Add item
        </Button>
      </div>
    )
  }
  return (
    <Input
      label={label}
      value={String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      placeholder={`Enter ${label.toLowerCase()}`}
    />
  )
}

// ─── Module card ──────────────────────────────────────────────────────────────

function ModuleCard({ mod, onChange }: {
  mod: ModuleInstance
  onChange: (updated: ModuleInstance) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = MODULE_LABELS[mod.module_key]

  function updateField(key: string, value: unknown) {
    onChange({ ...mod, config: { ...mod.config, [key]: value } })
  }

  return (
    <Card className={mod.enabled ? 'border-[var(--purple)]/20' : ''}>
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Toggle
            size="sm"
            checked={mod.enabled}
            onChange={v => onChange({ ...mod, enabled: v })}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text)]">{meta?.name ?? mod.module_key}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{meta?.description}</p>
          </div>
        </div>
        {mod.enabled && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1 shrink-0"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {mod.enabled && expanded && (
        <div className="border-t border-[var(--border)] px-5 py-4 space-y-4">
          {Object.entries(mod.config).map(([key, val]) => (
            <ConfigField
              key={key}
              label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              fieldKey={key}
              value={val}
              onChange={v => updateField(key, v)}
            />
          ))}
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

  // Initialise spec from latest active revision or create a blank one
  useEffect(() => {
    if (!botData?.bot || spec) return

    const active = revisionsData?.revisions?.find(r => r.isActive)
    if (active && active.configuration && typeof active.configuration === 'object') {
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

    // Fallback to known modules if API not available
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
      toast.success('Deployed!')
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
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
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
            <p className="text-xs text-[var(--text-muted)]">{enabledCount} module{enabledCount !== 1 ? 's' : ''} enabled</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Save />}
            loading={save.isPending}
            disabled={!isDirty}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
          <Button
            size="sm"
            loading={deploy.isPending}
            onClick={() => deploy.mutate()}
          >
            Save &amp; deploy
          </Button>
        </div>
      </div>

      {isDirty && (
        <Alert variant="warning">You have unsaved changes.</Alert>
      )}

      {/* Module list */}
      <div className="space-y-3">
        {spec.modules.map((mod, i) => (
          <ModuleCard key={mod.module_key} mod={mod} onChange={u => updateModule(i, u)} />
        ))}
      </div>
    </div>
  )
}
