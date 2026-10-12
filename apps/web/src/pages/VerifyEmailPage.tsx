import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authApi } from '../api/client'
import { Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')

  const verify = useMutation({
    mutationFn: () => authApi.verifyEmail(token!),
    onSuccess: () => toast.success('Email verified! You can now log in.'),
    onError: () => toast.error('Verification failed. The link may have expired.'),
  })

  useEffect(() => {
    if (token) verify.mutate()
  }, [token]) // eslint-disable-line

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-[var(--text)]">BotForge</span>
        </div>

        {verify.isPending && (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-[var(--purple)] mx-auto animate-spin" />
            <p className="text-[var(--text-secondary)]">Verifying your email…</p>
          </div>
        )}

        {verify.isSuccess && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[var(--success)] mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]">Email verified</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">Your account is ready to use.</p>
            </div>
            <Button onClick={() => navigate('/login')} className="w-full">Go to login</Button>
          </div>
        )}

        {verify.isError && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-[var(--error)] mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]">Verification failed</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">This link may have expired or already been used.</p>
            </div>
            <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">Back to login</Button>
          </div>
        )}

        {!token && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-[var(--error)] mx-auto" />
            <p className="text-[var(--text-muted)]">No verification token found.</p>
            <Button variant="secondary" onClick={() => navigate('/login')} className="w-full">Back to login</Button>
          </div>
        )}
      </div>
    </div>
  )
}
