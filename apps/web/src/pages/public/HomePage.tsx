import { Link } from 'react-router-dom'
import { Zap, Bot, Rocket, Shield, ArrowRight, Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'

const FEATURES = [
  { icon: Bot,    title: 'No code required',       desc: 'Describe your bot in plain English. We handle the rest.' },
  { icon: Zap,    title: 'Deploy in seconds',       desc: 'From idea to live bot in under 5 minutes.' },
  { icon: Rocket, title: 'Managed hosting',         desc: '24/7 uptime, automatic restarts, real-time monitoring.' },
  { icon: Shield, title: 'Powerful modules',        desc: 'Welcome messages, moderation, custom commands, and more.' },
]

const MODULES = [
  { name: 'Welcome Messages', desc: 'Greet new members automatically', plan: 'Free' },
  { name: 'Auto-Role',        desc: 'Assign roles when members join', plan: 'Free' },
  { name: 'Custom Commands',  desc: 'Create slash commands',          plan: 'Free' },
  { name: 'Moderation',       desc: 'Warn, timeout, kick, and ban',   plan: 'Free' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Nav */}
      <header className="border-b border-[var(--border)] sticky top-0 z-30" style={{ background: 'var(--bg-sidebar)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[var(--purple)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text)]">BotForge</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get started free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--purple)]/30 bg-[var(--purple-tint)] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--purple-light)]" />
          <span className="text-xs font-medium text-[var(--purple-light)]">No code required</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-[var(--text)] leading-tight mb-6">
          Your ideas. Your bot.<br />
          <span style={{ color: 'var(--purple-light)' }}>No code.</span>
        </h1>

        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10">
          Describe what you want your Discord bot to do. We build it, host it, and keep it running — 24/7.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register">
            <Button size="lg" iconRight={<ArrowRight />}>Build my bot</Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="secondary">Sign in</Button>
          </Link>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-4">Free to start. No credit card required.</p>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text)]">Everything you need</h2>
          <p className="text-[var(--text-secondary)] mt-2">Powerful features without the complexity.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--purple-tint)] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[var(--purple-light)]" />
              </div>
              <h3 className="font-semibold text-[var(--text)]">{title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text)]">How it works</h2>
          <p className="text-[var(--text-secondary)] mt-2">From idea to deployed bot in minutes.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { n: '1', title: 'Describe',  desc: 'Tell us what you want your bot to do in plain language.' },
            { n: '2', title: 'Customize', desc: 'Choose your modules and configure the details.' },
            { n: '3', title: 'Deploy',    desc: 'Add it to your server. We handle the hosting and uptime.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--purple)] text-white font-bold text-lg flex items-center justify-center mx-auto">
                {n}
              </div>
              <h3 className="font-semibold text-[var(--text)]">{title}</h3>
              <p className="text-sm text-[var(--text-muted)]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[var(--text)]">Available modules</h2>
          <p className="text-[var(--text-secondary)] mt-2">Enable only what you need. All free to start.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {MODULES.map(m => (
            <div key={m.name} className="flex items-center gap-4 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4">
              <Check className="w-4 h-4 text-[var(--success)] shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--text)]">{m.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{m.desc}</p>
              </div>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[#4ade8015] text-[var(--success)] border border-[var(--success)]/20 shrink-0">
                {m.plan}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-[var(--border)] text-center">
        <h2 className="text-3xl font-bold text-[var(--text)] mb-4">Your next bot starts here.</h2>
        <p className="text-[var(--text-secondary)] mb-8">Free to start. No credit card. No code.</p>
        <Link to="/register">
          <Button size="lg" iconRight={<ArrowRight />}>Build my bot</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)]" style={{ background: 'var(--bg-sidebar)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-[var(--purple)] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-[var(--text)]">BotForge</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} BotForge. All rights reserved.</p>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <Link to="/privacy" className="hover:text-[var(--text)] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[var(--text)] transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
