import { Input } from '../ui/Input'
import { Toggle } from '../ui/Toggle'

interface ModerationConfig {
  log_channel_id: string
  warning_limit: number
  warning_action: string
  timeout_duration_minutes: number
  anti_spam: boolean
  anti_spam_threshold: number
}

interface Props {
  config: ModerationConfig
  onChange: (config: ModerationConfig) => void
}

export function ModerationModuleEditor({ config, onChange }: Props) {
  function set<K extends keyof ModerationConfig>(key: K, value: ModerationConfig[K]) {
    onChange({ ...config, [key]: value })
  }

  return (
    <div className="space-y-4">
      <Input
        label="Log Channel ID"
        hint="Channel where moderation actions will be logged"
        placeholder="e.g. 1234567890123456789"
        value={config.log_channel_id}
        onChange={e => set('log_channel_id', e.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Warning limit"
          hint="Warnings before action is taken"
          type="number"
          min={1}
          max={20}
          value={String(config.warning_limit)}
          onChange={e => set('warning_limit', Number(e.target.value))}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Action on limit</label>
          <select
            value={config.warning_action}
            onChange={e => set('warning_action', e.target.value)}
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:border-transparent hover:border-[var(--border-strong)] transition-colors"
          >
            <option value="timeout">Timeout</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
          <p className="text-xs text-[var(--text-muted)]">What happens when warning limit is hit</p>
        </div>
      </div>

      {config.warning_action === 'timeout' && (
        <Input
          label="Timeout duration (minutes)"
          hint="How long to timeout the member"
          type="number"
          min={1}
          max={40320}
          value={String(config.timeout_duration_minutes)}
          onChange={e => set('timeout_duration_minutes', Number(e.target.value))}
        />
      )}

      <div className="border-t border-[var(--border)] pt-4 space-y-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Anti-spam</p>
        <Toggle
          label="Enable anti-spam"
          description="Automatically delete repeated messages and warn spammers"
          checked={config.anti_spam}
          onChange={v => set('anti_spam', v)}
        />

        {config.anti_spam && (
          <Input
            label="Spam threshold"
            hint="Number of identical messages in 10s that triggers anti-spam"
            type="number"
            min={2}
            max={20}
            value={String(config.anti_spam_threshold)}
            onChange={e => set('anti_spam_threshold', Number(e.target.value))}
          />
        )}
      </div>
    </div>
  )
}
