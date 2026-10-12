import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore(s => s.setUser)
  const from = (location.state as any)?.from?.pathname ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const login = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: ({ user }) => {
      setUser(user)
      navigate(from, { replace: true })
    },
    onError: () => toast.error('Email or password is incorrect.'),
  })

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between p-12 border-r border-[var(--border)]" style={{ background: 'var(--bg-sidebar)' }}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-[var(--text)]">BotForge</span>
        </Link>

        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-[var(--text)] leading-tight">
            Your Discord bot.<br />
            <span style={{ color: 'var(--purple-light)' }}>No code required.</span>
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Create, configure, and deploy Discord bots in minutes. Managed hosting, real-time monitoring, and powerful modules — all in one place.
          </p>
          <div className="space-y-3">
            {['Managed 24/7 hosting', 'Welcome messages & auto-roles', 'Moderation & custom commands', 'Twitch notifications'].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--purple-light)]" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} BotForge. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text)]">BotForge</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Welcome back</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Sign in to your account to continue.</p>
          </div>

          <form
            onSubmit={e => { e.preventDefault(); login.mutate() }}
            className="space-y-4"
          >
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
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              rightIcon={
                <button type="button" onClick={() => setShowPw(v => !v)} className="hover:text-[var(--text)] transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-[var(--text-muted)] hover:text-[var(--purple-light)] transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              loading={login.isPending}
              className="w-full"
              iconRight={<ArrowRight />}
            >
              Sign in
            </Button>
          </form>

          <p className="text-sm text-center text-[var(--text-muted)]">
            Don't have an account?{' '}
            <Link to="/register" className="text-[var(--purple-light)] hover:underline font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
