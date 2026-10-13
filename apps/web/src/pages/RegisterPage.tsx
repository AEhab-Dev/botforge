import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)

  const register = useMutation({
    mutationFn: () => authApi.register({ email, password, displayName }),
    onSuccess: (data) => {
      if ((data as any).dev_verification_token) {
        setDevToken((data as any).dev_verification_token)
      } else {
        toast.success('Account created! Check your email to verify.')
        navigate('/login')
      }
    },
    onError: (err: any) => {
      if (err?.code === 'EMAIL_TAKEN') toast.error('An account with this email already exists.')
      else toast.error('Something went wrong. Please try again.')
    },
  })

  if (devToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text)]">BotForge</span>
          </div>
          <Alert variant="success" title="Account created!">
            Email sending isn't configured in dev. Use this token to verify:
          </Alert>
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <code className="text-xs text-[var(--purple-light)] break-all">{devToken}</code>
          </div>
          <Button
            onClick={() => navigate(`/verify-email?token=${devToken}`)}
            className="w-full"
          >
            Verify and continue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between p-12 border-r border-[var(--border)]" style={{ background: 'var(--bg-sidebar)' }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-[var(--text)]">BotForge</span>
        </Link>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-[var(--text)] leading-tight">
            Start building<br />
            <span style={{ color: 'var(--purple-light)' }}>your first bot today.</span>
          </h2>
          <p className="text-[var(--text-secondary)]">Free to start. No credit card required.</p>
        </div>
        <p className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} BotForge</p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text)]">BotForge</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Create your account</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Get started — it's free.</p>
          </div>

          <form onSubmit={e => { e.preventDefault(); register.mutate() }} className="space-y-4">
            <Input
              label="Display name"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              error={password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters' : undefined}
              hint={password.length === 0 ? 'Minimum 8 characters' : undefined}
              rightIcon={
                <button type="button" onClick={() => setShowPw(v => !v)} className="hover:text-[var(--text)] transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <p className="text-xs text-[var(--text-muted)]">
              By creating an account you agree to our{' '}
              <Link to="/terms" className="text-[var(--purple-light)] hover:underline">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-[var(--purple-light)] hover:underline">Privacy Policy</Link>.
            </p>

            <Button
              type="submit"
              loading={register.isPending}
              disabled={!displayName.trim() || !email.trim() || password.length < 8}
              className="w-full"
              iconRight={<ArrowRight />}
            >
              Create account
            </Button>
          </form>

          <p className="text-sm text-center text-[var(--text-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--purple-light)] hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
