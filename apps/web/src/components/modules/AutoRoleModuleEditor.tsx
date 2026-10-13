import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface AutoRoleConfig {
  role_ids: string[]
}

interface Props {
  config: AutoRoleConfig
  onChange: (config: AutoRoleConfig) => void
}

export function AutoRoleModuleEditor({ config, onChange }: Props) {
  const [newRoleId, setNewRoleId] = useState('')

  function addRole() {
    const trimmed = newRoleId.trim()
    if (!trimmed || config.role_ids.includes(trimmed)) return
    onChange({ role_ids: [...config.role_ids, trimmed] })
    setNewRoleId('')
  }

  function removeRole(id: string) {
    onChange({ role_ids: config.role_ids.filter(r => r !== id) })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">Roles to assign on join</p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          These roles will be automatically assigned when a new member joins the server.
          Right-click a role in Discord Server Settings → Copy Role ID.
        </p>

        {config.role_ids.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] italic">No roles added yet.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {config.role_ids.map(id => (
              <div key={id} className="flex items-center gap-2">
                <div className="flex-1 h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] flex items-center">
                  <span className="text-sm text-[var(--text-secondary)] font-mono">{id}</span>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => removeRole(id)}
                  aria-label="Remove role"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="Role ID (e.g. 1234567890123456789)"
            value={newRoleId}
            onChange={e => setNewRoleId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRole()}
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={addRole}
            disabled={!newRoleId.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
