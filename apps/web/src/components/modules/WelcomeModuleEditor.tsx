import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'
import { Textarea } from '../ui/Textarea'

interface WelcomeConfig {
  channel_id: string
  message_template: string
  auto_role_id: string
  use_embed: boolean
}

interface Props {
  config: WelcomeConfig
  onChange: (config: Record<string, unknown>) => void
}

export function WelcomeModuleEditor({ config, onChange }: Props) {
  function set<K extends keyof WelcomeConfig>(key: K, value: WelcomeConfig[K]) {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-4">
      <Input
        label="Welcome Channel ID"
        hint="Right-click a channel in Discord → Copy Channel ID"
        placeholder="e.g. 1234567890123456789"
        value={config.channel_id}
        onChange={e => set('channel_id', e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--text-secondary)]">
          Welcome Message
        </label>
        <Textarea
          placeholder="Welcome {user} to {server}!"
          value={config.message_template}
          onChange={e => set('message_template', e.target.value)}
          rows={3}
        />
        <p className="text-xs text-[var(--text-muted)]">
          Use <code className="bg-[var(--bg-raised)] px-1 rounded">{'{user}'}</code> for the member mention,{' '}
          <code className="bg-[var(--bg-raised)] px-1 rounded">{'{server}'}</code> for the server name,{' '}
          <code className="bg-[var(--bg-raised)] px-1 rounded">{'{count}'}</code> for member count.
        </p>
      </div>

      <Input
        label="Auto-assign Role ID (optional)"
        hint="Role to assign automatically when a member joins"
        placeholder="e.g. 1234567890123456789"
        value={config.auto_role_id}
        onChange={e => set('auto_role_id', e.target.value)}
      />

      <Toggle
        label="Use embed message"
        description="Send the welcome message as a rich embed instead of plain text"
        checked={config.use_embed}
        onChange={v => set('use_embed', v)}
      />
    </div>
  )
}
