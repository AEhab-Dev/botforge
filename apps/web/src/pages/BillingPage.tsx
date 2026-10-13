import { useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CreditCard, Check, Zap, Building2, ExternalLink,
  AlertCircle, CalendarDays, RefreshCw,
} from 'lucide-react'
import { billingApi } from '../api/client'
import type { Plan } from '../api/client'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { Skeleton } from '../components/ui/Skeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))
  const atLimit = used >= limit
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={atLimit ? 'text-[var(--error)] font-medium' : 'text-[var(--text)]'}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)]">
        <div
          className={`h-2 rounded-full transition-all ${atLimit ? 'bg-[var(--error)]' : 'bg-[var(--purple)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {atLimit && (
        <p className="text-xs text-[var(--error)] mt-1">Limit reached — upgrade to create more.</p>
      )}
    </div>
  )
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  isDowngrade,
  onUpgrade,
  loading,
}: {
  plan: Plan
  isCurrent: boolean
  isDowngrade: boolean
  onUpgrade: (planId: string) => void
  loading: boolean
}) {
  const isPro = plan.id === 'pro'
  const isBusiness = plan.id === 'business'
  const isFree = plan.id === 'free'

  return (
    <Card className={isCurrent ? 'border-[var(--purple)]/50 ring-1 ring-[var(--purple)]/20' : ''}>
      <CardBody className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              {isBusiness && <Building2 className="w-4 h-4 text-[var(--purple-light)]" />}
              {isPro && <Zap className="w-4 h-4 text-[var(--warning)]" />}
              <p className="font-semibold text-[var(--text)]">{plan.name}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text)] mt-1">
              {plan.price === 0 ? 'Free' : `$${plan.price}`}
              {plan.interval && (
                <span className="text-sm font-normal text-[var(--text-muted)]">/{plan.interval}</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isCurrent && <Badge variant="success">Current</Badge>}
            {isPro && !isCurrent && <Badge variant="info">Popular</Badge>}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-5">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isFree ? (
          <Button variant="secondary" disabled className="w-full">
            {isCurrent ? 'Current plan' : 'Downgrade'}
          </Button>
        ) : isCurrent ? (
          <Button variant="secondary" disabled className="w-full">
            Current plan
          </Button>
        ) : isDowngrade ? (
          <Button variant="secondary" disabled className="w-full">
            Downgrade via portal
          </Button>
        ) : (
          <Button
            className="w-full"
            loading={loading}
            icon={isBusiness ? <Building2 className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            onClick={() => onUpgrade(plan.id)}
          >
            Upgrade to {plan.name}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [params, setParams] = useSearchParams()

  // Handle Stripe redirect callbacks
  useEffect(() => {
    if (params.get('success') === '1') {
      toast.success('Subscription activated! Welcome to your new plan.')
      setParams({}, { replace: true })
    } else if (params.get('canceled') === '1') {
      toast('Checkout canceled — no charge was made.', { icon: 'ℹ️' })
      setParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error } = useQuery({
    queryKey: ['billing'],
    queryFn: billingApi.get,
  })

  const checkout = useMutation({
    mutationFn: (planId: 'pro' | 'business') => billingApi.checkout(planId),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url
    },
    onError: (err: any) => toast.error(err?.message ?? 'Failed to start checkout.'),
  })

  const portal = useMutation({
    mutationFn: billingApi.portal,
    onSuccess: ({ url }) => {
      if (url) window.location.href = url
    },
    onError: (err: any) => {
      if (err?.code === 'PORTAL_FAILED') {
        toast.error('Subscribe to a paid plan first to access the billing portal.')
      } else {
        toast.error('Failed to open billing portal.')
      }
    },
  })

  const subscription = data?.subscription
  const currentPlan = data?.plan
  const plans = data?.plans ?? []

  const isPaid = currentPlan && currentPlan.id !== 'free'
  const planHierarchy = ['free', 'pro', 'business']
  const currentPlanIdx = planHierarchy.indexOf(currentPlan?.id ?? 'free')

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="error" className="max-w-3xl">
        Failed to load billing information. Please refresh the page.
      </Alert>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Billing & Plan</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your subscription and usage.</p>
      </div>

      {/* ── Current plan ─────────────────────────────────────────── */}
      <Card>
        <CardHeader
          icon={<CreditCard className="w-4 h-4" />}
          title="Current plan"
          description={`You are on the ${currentPlan?.name ?? 'Free'} plan.`}
          action={
            isPaid ? (
              <Button
                size="sm"
                variant="secondary"
                loading={portal.isPending}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => portal.mutate()}
              >
                Manage
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-[var(--text)]">{currentPlan?.name}</span>
              <Badge variant={isPaid ? 'success' : 'default'}>
                {subscription?.status ?? 'active'}
              </Badge>
            </div>

            {isPaid && subscription?.currentPeriodEnd && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <CalendarDays className="w-3.5 h-3.5" />
                {subscription.cancelAtPeriodEnd
                  ? `Cancels ${fmtDate(subscription.currentPeriodEnd)}`
                  : `Renews ${fmtDate(subscription.currentPeriodEnd)}`}
              </div>
            )}

            {subscription?.cancelAtPeriodEnd && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--warning)]">
                <AlertCircle className="w-3.5 h-3.5" />
                Cancellation scheduled
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ── Usage ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          icon={<RefreshCw className="w-4 h-4" />}
          title="Usage"
          description="Your current resource usage."
        />
        <CardBody className="space-y-4">
          <UsageBar
            label="Bots"
            used={1}
            limit={currentPlan?.botLimit ?? 1}
          />
        </CardBody>
      </Card>

      {/* ── Plans ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-4">Available plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlan?.id}
              isDowngrade={planHierarchy.indexOf(plan.id) < currentPlanIdx}
              loading={checkout.isPending && checkout.variables === plan.id}
              onUpgrade={id => checkout.mutate(id as 'pro' | 'business')}
            />
          ))}
        </div>

        {isPaid && (
          <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
            To cancel or downgrade, use the{' '}
            <button
              onClick={() => portal.mutate()}
              className="text-[var(--purple-light)] hover:underline"
            >
              billing portal
            </button>
            .
          </p>
        )}
      </div>
    </div>
  )
}
