import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Zap, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { authApi } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const forgot = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => setSent(true),
    onError: () => {
      // Always show success to avoid email enumeration
      setSent(true)
    },
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[var(--text)]">BotForge</span>
        </Link>

        {sent ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-[var(--success)] shrink-0" />
              <div>
                <h1 className="text-xl font-bold text-[var(--text)]">Check your email</h1>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  If an account exists for {email}, we've sent a reset link.
                </p>
              </div>
            </div>
            <Alert variant="info">
              The link expires in 1 hour. Check your spam folder if you don't see it.
            </Alert>
            <Link to="/login">
              <Button variant="secondary" icon={<ArrowLeft />} className="w-full">Back to login</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">Reset your password</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            <form onSubmit={e => { e.preventDefault(); forgot.mutate() }} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" loading={forgot.isPending} iconRight={<ArrowRight />} className="w-full">
                Send reset link
              </Button>
            </form>

            <Link to="/login" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
