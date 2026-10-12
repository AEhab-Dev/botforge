import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Zap, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onSuccess: () => {
      toast.success('Password updated. Please sign in.')
      navigate('/login')
    },
    onError: (err: any) => {
      if (err?.code === 'TOKEN_EXPIRED' || err?.code === 'TOKEN_INVALID') {
        toast.error('This reset link has expired or already been used.')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    },
  })

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm space-y-6 text-center">
          <Alert variant="error" title="Invalid link">
            This reset link is missing or malformed.
          </Alert>
          <Link to="/forgot-password">
            <Button variant="secondary" className="w-full">Request a new link</Button>
          </Link>
        </div>
      </div>
    )
  }

  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[var(--text)]">BotForge</span>
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Set a new password</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Choose a strong password for your account.</p>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault()
            if (password !== confirm) return
            reset.mutate()
          }}
          className="space-y-4"
        >
          <Input
            label="New password"
            type={showPw ? 'text' : 'password'}
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            hint="Minimum 8 characters"
            rightIcon={
              <button type="button" onClick={() => setShowPw(v => !v)} className="hover:text-[var(--text)] transition-colors">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          <Input
            label="Confirm password"
            type={showPw ? 'text' : 'password'}
            placeholder="Same password again"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            error={mismatch ? 'Passwords do not match' : undefined}
          />

          <Button
            type="submit"
            loading={reset.isPending}
            disabled={mismatch || password.length < 8}
            iconRight={<ArrowRight />}
            className="w-full"
          >
            Update password
          </Button>
        </form>
      </div>
    </div>
  )
}
