import { CreditCard, Check, Zap } from 'lucide-react'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

const FREE_FEATURES = [
  '1 bot',
  'Welcome messages',
  'Auto-roles',
  'Custom commands',
  'Basic moderation',
  'Community support',
]

const PRO_FEATURES = [
  'Up to 5 bots',
  'All free features',
  'Twitch notifications',
  'YouTube notifications',
  'Scheduled announcements',
  'Ticket system',
  'Priority support',
  'Longer log retention',
]

export default function BillingPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Billing & Plan</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your subscription and usage.</p>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader
          icon={<CreditCard className="w-4 h-4" />}
          title="Current plan"
          description="You are on the Free plan."
        />
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-[var(--purple-tint)] text-[var(--purple-light)] text-sm font-medium">
              Free
            </div>
            <span className="text-sm text-[var(--text-muted)]">No payment required</span>
          </div>
        </CardBody>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader title="Usage" description="Your current usage this month." />
        <CardBody className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-[var(--text-secondary)]">Bots</span>
              <span className="text-[var(--text)]">1 / 1</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-hover)]">
              <div className="h-2 rounded-full bg-[var(--purple)]" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Free plan limit reached. Upgrade to create more bots.</p>
          </div>
        </CardBody>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text)] mb-4">Available plans</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Free */}
          <Card className="border-[var(--purple)]/30">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[var(--text)]">Free</p>
                  <p className="text-2xl font-bold text-[var(--text)] mt-1">$0<span className="text-sm font-normal text-[var(--text-muted)]">/mo</span></p>
                </div>
                <Badge variant="info">Current plan</Badge>
              </div>
              <ul className="space-y-2">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" disabled className="w-full mt-5">
                Current plan
              </Button>
            </CardBody>
          </Card>

          {/* Pro */}
          <Card>
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-[var(--text)]">Pro</p>
                  <p className="text-2xl font-bold text-[var(--text)] mt-1">$9<span className="text-sm font-normal text-[var(--text-muted)]">/mo</span></p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--purple-tint)] text-xs font-medium text-[var(--purple-light)]">
                  <Zap className="w-3 h-3" />
                  Popular
                </div>
              </div>
              <ul className="space-y-2">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button disabled className="w-full mt-5" icon={<Zap className="w-4 h-4" />}>
                Upgrade — Coming Soon
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
