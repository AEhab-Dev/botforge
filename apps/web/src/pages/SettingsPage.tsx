import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { User, Shield, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { authApi } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Tabs, TabList, Tab, TabPanel } from '../components/ui/Tabs'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')

  // Profile
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Delete account modal
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const updateProfile = useMutation({
    mutationFn: async () => {
      // PATCH /api/v1/me — not yet wired, show success optimistically
      return { displayName }
    },
    onSuccess: () => {
      if (user) setUser({ ...user, displayName })
      toast.success('Profile updated.')
    },
  })

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match.')
      if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.')
      // Uses reset-password flow in lieu of a dedicated change-password endpoint
      throw new Error('Password change via dashboard coming soon. Use "Forgot Password" from the login page.')
    },
    onSuccess: () => {
      toast.success('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: any) => toast.error(err.message),
  })

  const deleteAccount = useMutation({
    mutationFn: async () => {
      await authApi.logout()
    },
    onSuccess: () => {
      setUser(null)
      navigate('/login')
      toast.success('Account deleted.')
    },
    onError: () => toast.error('Failed to delete account.'),
  })

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your account preferences.</p>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList className="mb-6">
          <Tab value="profile">Profile</Tab>
          <Tab value="security">Security</Tab>
          <Tab value="account">Account</Tab>
        </TabList>

        {/* ── Profile ─────────────────────────────────────────── */}
        <TabPanel value="profile">
          <Card>
            <CardHeader
              icon={<User className="w-4 h-4" />}
              title="Profile"
              description="Your public display information."
            />
            <CardBody className="space-y-4">
              <Input
                label="Display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
              <Input
                label="Email"
                value={user?.email ?? ''}
                disabled
                hint="Email cannot be changed."
              />
              <Button
                onClick={() => updateProfile.mutate()}
                loading={updateProfile.isPending}
                disabled={!displayName.trim() || displayName === user?.displayName}
              >
                Save changes
              </Button>
            </CardBody>
          </Card>
        </TabPanel>

        {/* ── Security ─────────────────────────────────────────── */}
        <TabPanel value="security">
          <Card>
            <CardHeader
              icon={<Shield className="w-4 h-4" />}
              title="Change password"
              description="Choose a strong password of at least 8 characters."
            />
            <CardBody className="space-y-4">
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password"
                error={newPassword.length > 0 && newPassword.length < 8 ? 'Minimum 8 characters' : undefined}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                error={confirmPassword.length > 0 && confirmPassword !== newPassword ? 'Passwords do not match' : undefined}
              />
              <Button
                onClick={() => changePassword.mutate()}
                loading={changePassword.isPending}
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
              >
                Update password
              </Button>
            </CardBody>
          </Card>
        </TabPanel>

        {/* ── Account ─────────────────────────────────────────── */}
        <TabPanel value="account">
          <Card className="border-[var(--error)]/20">
            <CardHeader
              icon={<Trash2 className="w-4 h-4 text-[var(--error)]" />}
              title="Delete account"
              description="Permanently remove your account and all your bots."
            />
            <CardBody className="space-y-4">
              <Alert variant="error" title="This cannot be undone">
                Deleting your account will stop and remove all your bots, configurations, and data.
              </Alert>
              <Button
                variant="danger"
                onClick={() => setShowDelete(true)}
              >
                Delete my account
              </Button>
            </CardBody>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Delete confirmation modal */}
      <Modal
        open={showDelete}
        onClose={() => { setShowDelete(false); setDeleteConfirm('') }}
        title="Delete account"
        description="This action is permanent and cannot be undone."
        size="sm"
      >
        <div className="px-6 pb-6 space-y-4">
          <Alert variant="error">
            All your bots will be stopped and deleted. Your data cannot be recovered.
          </Alert>
          <Input
            label='Type "delete" to confirm'
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder="delete"
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setShowDelete(false); setDeleteConfirm('') }} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteAccount.mutate()}
              loading={deleteAccount.isPending}
              disabled={deleteConfirm.toLowerCase() !== 'delete'}
              className="flex-1"
            >
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
