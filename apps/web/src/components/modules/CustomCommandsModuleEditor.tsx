import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'


interface Command {
  name: string
  description: string
  response_type: 'text' | 'embed' | 'link'
  content: string
  required_role_id: string
}

interface CustomCommandsConfig {
  commands: Command[]
}

interface Props {
  config: CustomCommandsConfig
  onChange: (config: Record<string, unknown>) => void
}

const EMPTY_COMMAND: Command = {
  name: '',
  description: '',
  response_type: 'text',
  content: '',
  required_role_id: '',
}

function CommandCard({ cmd, index, onChange, onRemove }: {
  cmd: Command
  index: number
  onChange: (cmd: Command) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  function set<K extends keyof Command>(key: K, value: Command[K]) {
    onChange({ ...cmd, [key]: value })
  }

  return (
    <div className="border border-[var(--border)] rounded-[10px] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[var(--bg-raised)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono text-[var(--purple)] bg-[var(--purple-tint)] px-1.5 py-0.5 rounded shrink-0">
            /{cmd.name || `command-${index + 1}`}
          </span>
          {cmd.description && (
            <span className="text-xs text-[var(--text-muted)] truncate">{cmd.description}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-1 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <Button
            variant="danger"
            size="xs"
            icon={<Trash2 className="w-3 h-3" />}
            onClick={onRemove}
            aria-label="Remove command"
          />
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-3 border-t border-[var(--border)]">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Command name"
              hint="No spaces, lowercase (e.g. help)"
              placeholder="help"
              value={cmd.name}
              onChange={e => set('name', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            />
            <Input
              label="Description"
              hint="Shown in Discord's slash command picker"
              placeholder="Shows help info"
              value={cmd.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Response type</label>
            <select
              value={cmd.response_type}
              onChange={e => set('response_type', e.target.value as Command['response_type'])}
              className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] px-3 focus:outline-none focus:ring-2 focus:ring-[var(--purple)] focus:border-transparent hover:border-[var(--border-strong)] transition-colors"
            >
              <option value="text">Plain text</option>
              <option value="embed">Rich embed</option>
              <option value="link">Button link</option>
            </select>
          </div>

          {cmd.response_type === 'link' ? (
            <Input
              label="URL"
              hint="URL the button will open"
              placeholder="https://example.com"
              value={cmd.content}
              onChange={e => set('content', e.target.value)}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Response content</label>
              <Textarea
                placeholder={cmd.response_type === 'embed' ? 'Embed description text' : 'Reply text'}
                value={cmd.content}
                onChange={e => set('content', e.target.value)}
                rows={2}
              />
            </div>
          )}

          <Input
            label="Required role ID (optional)"
            hint="Leave blank to allow everyone"
            placeholder="e.g. 1234567890123456789"
            value={cmd.required_role_id}
            onChange={e => set('required_role_id', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

export function CustomCommandsModuleEditor({ config, onChange }: Props) {
  function addCommand() {
    onChange({ commands: [...config.commands, { ...EMPTY_COMMAND }] })
  }

  function updateCommand(index: number, cmd: Command) {
    const next = [...config.commands]
    next[index] = cmd
    onChange({ commands: next })
  }

  function removeCommand(index: number) {
    onChange({ commands: config.commands.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3">
      {config.commands.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic">
          No commands yet. Add one below.
        </p>
      ) : (
        config.commands.map((cmd, i) => (
          <CommandCard
            key={i}
            cmd={cmd}
            index={i}
            onChange={cmd => updateCommand(i, cmd)}
            onRemove={() => removeCommand(i)}
          />
        ))
      )}

      <Button
        variant="secondary"
        size="sm"
        icon={<Plus className="w-4 h-4" />}
        onClick={addCommand}
        disabled={config.commands.length >= 25}
      >
        Add command {config.commands.length > 0 && `(${config.commands.length}/25)`}
      </Button>
    </div>
  )
}
