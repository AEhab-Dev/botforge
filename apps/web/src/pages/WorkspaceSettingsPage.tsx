import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Settings, Users, UserPlus, Trash2, ChevronDown, Building2,
} from 'lucide-react'
import { workspaceApi } from '../api/client'
import type { WorkspaceMember } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Tabs, TabList, Tab, TabPanel } from '../components/ui/Tabs'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-[var(--purple-tint)] text-[var(--purple-light)] border-[var(--purple)]/20',
    admin: 'bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/20',
    member: 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${styles[role] ?? styles.member}`}>
      {role}
    </span>
  )
}

// ─── Member avatar ────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--purple-tint)] flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-[var(--purple-light)]">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({ member, isOwner, currentUserId, onRoleChange, onRemove }: {
  member: WorkspaceMember
  isOwner: boolean
  currentUserId: string
  onRoleChange: (userId: string, role: 'member' | 'admin') => void
  onRemove: (userId: string) => void
}) {
  const isSelf = member.userId === currentUserId
  const isActualOwner = member.role === 'owner'
  const canManage = isOwner && !isSelf && !isActualOwner

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={member.displayName} avatarUrl={member.avatarUrl} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--text)] truncate">{member.displayName}</p>
            {isSelf && <span className="text-xs text-[var(--text-muted)]">(you)</span>}
          </div>
          <p className="text-xs text-[var(--text-muted)] truncate">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <RoleBadge role={member.role} />

        {canManage && (
          <>
            <div className="relative group">
              <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] flex items-center gap-0.5 transition-colors p-1">
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-32 bg-[var(--bg-card)] border border-[var(--border)] rounded-[8px] shadow-lg z-10 hidden group-hover:block">
                {(['admin', 'member'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => onRoleChange(member.userId, r)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-hover)] transition-colors first:rounded-t-[8px] last:rounded-b-[8px] ${member.role === r ? 'text-[var(--purple-light)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    Set as {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onRemove(member.userId)}
              className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors p-1"
              aria-label={`Remove ${member.displayName}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState('general')

  // General
  const [workspaceName, setWorkspaceName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)

  // Invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [showInvite, setShowInvite] = useState(false)

  // Remove confirm
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: workspaceApi.get,
  })

  // Sync workspace name into local state once loaded
  const workspace = data?.workspace
  const members = data?.members ?? []
  const isOwner = workspace?.ownerId === user?.id

  // Initialise name field from fetched data (only if user hasn't started editing)
  if (workspace && !nameEdited && workspaceName !== workspace.name) {
    setWorkspaceName(workspace.name)
  }

  const saveName = useMutation({
    mutationFn: () => workspaceApi.update(workspaceName.trim()),
    onSuccess: () => {
      toast.success('Workspace name updated.')
      qc.invalidateQueries({ queryKey: ['workspace'] })
      setNameEdited(false)
    },
    onError: () => toast.error('Failed to update workspace name.'),
  })

  const invite = useMutation({
    mutationFn: () => workspaceApi.inviteMember(inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      toast.success(`${inviteEmail} added to workspace.`)
      setInviteEmail('')
      setShowInvite(false)
      qc.invalidateQueries({ queryKey: ['workspace'] })
    },
    onError: (err: any) => {
      if (err?.code === 'USER_NOT_FOUND') toast.error('No account found with that email. They need to sign up first.')
      else if (err?.code === 'ALREADY_MEMBER') toast.error('This person is already in the workspace.')
      else toast.error('Failed to send invite.')
    },
  })

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'member' | 'admin' }) =>
      workspaceApi.updateMemberRole(userId, role),
    onSuccess: () => {
      toast.success('Role updated.')
      qc.invalidateQueries({ queryKey: ['workspace'] })
    },
    onError: () => toast.error('Failed to update role.'),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => workspaceApi.removeMember(userId),
    onSuccess: () => {
      toast.success(`${removeTarget?.displayName} removed.`)
      setRemoveTarget(null)
      qc.invalidateQueries({ queryKey: ['workspace'] })
    },
    onError: () => toast.error('Failed to remove member.'),
  })

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Workspace</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage your workspace settings and team members.
        </p>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList className="mb-6">
          <Tab value="general">General</Tab>
          <Tab value="members">
            Members
            {members.length > 0 && (
              <span className="ml-1.5 text-xs bg-[var(--bg-raised)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full border border-[var(--border)]">
                {members.length}
              </span>
            )}
          </Tab>
        </TabList>

        {/* ── General ────────────────────────────────────────────── */}
        <TabPanel value="general">
          <Card>
            <CardHeader
              icon={<Building2 className="w-4 h-4" />}
              title="Workspace name"
              description="This name appears across your dashboard."
            />
            <CardBody className="space-y-4">
              <Input
                label="Name"
                value={workspaceName}
                onChange={e => { setWorkspaceName(e.target.value); setNameEdited(true) }}
                placeholder="My Workspace"
                disabled={!isOwner}
              />
              {isOwner && (
                <Button
                  size="sm"
                  loading={saveName.isPending}
                  disabled={!nameEdited || !workspaceName.trim()}
                  onClick={() => saveName.mutate()}
                >
                  Save name
                </Button>
              )}
              {!isOwner && (
                <Alert variant="info">Only the workspace owner can rename it.</Alert>
              )}
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardHeader
              icon={<Settings className="w-4 h-4" />}
              title="Workspace info"
              description="Read-only details about this workspace."
            />
            <CardBody>
              <dl className="space-y-3">
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--text-muted)]">Workspace ID</dt>
                  <dd className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-raised)] px-2 py-1 rounded-[6px]">
                    {workspace?.id.slice(0, 8)}…
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--text-muted)]">Created</dt>
                  <dd className="text-[var(--text-secondary)]">
                    {workspace ? new Date(workspace.createdAt).toLocaleDateString() : '—'}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-[var(--text-muted)]">Members</dt>
                  <dd className="text-[var(--text-secondary)]">{members.length}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </TabPanel>

        {/* ── Members ────────────────────────────────────────────── */}
        <TabPanel value="members">
          <Card>
            <CardHeader
              icon={<Users className="w-4 h-4" />}
              title="Team members"
              description="People who have access to this workspace."
              action={
                isOwner ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<UserPlus className="w-4 h-4" />}
                    onClick={() => setShowInvite(true)}
                  >
                    Invite
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              {members.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] italic">No members yet.</p>
              ) : (
                members.map(m => (
                  <MemberRow
                    key={m.userId}
                    member={m}
                    isOwner={isOwner}
                    currentUserId={user?.id ?? ''}
                    onRoleChange={(userId, role) => changeRole.mutate({ userId, role })}
                    onRemove={userId => setRemoveTarget(members.find(x => x.userId === userId) ?? null)}
                  />
                ))
              )}
            </CardBody>
          </Card>

          {!isOwner && (
            <Alert variant="info" className="mt-4">
              Only the workspace owner can invite and manage members.
            </Alert>
          )}
        </TabPanel>
      </Tabs>

      {/* ── Invite modal ────────────────────────────────────────── */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite team member"
        description="They need a BotForge account to accept the invite."
      >
        <div className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="teammate@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite.mutate()}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Role</label>
            <div className="flex gap-2">
              {(['member', 'admin'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`flex-1 py-2 rounded-[8px] text-sm font-medium border transition-all capitalize ${
                    inviteRole === r
                      ? 'bg-[var(--purple)] text-white border-[var(--purple)]'
                      : 'bg-[var(--bg-raised)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {r === 'admin' ? '🛡️ Admin' : '👤 Member'}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {inviteRole === 'admin' ? 'Admins can manage bots and members.' : 'Members can view and manage bots.'}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={invite.isPending}
              disabled={!inviteEmail.trim()}
              onClick={() => invite.mutate()}
            >
              Send invite
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Remove confirm modal ────────────────────────────────── */}
      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove member"
        description={`Remove ${removeTarget?.displayName} from this workspace? They'll lose access to all bots immediately.`}
      >
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setRemoveTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={removeMember.isPending}
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => removeTarget && removeMember.mutate(removeTarget.userId)}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  )
}
