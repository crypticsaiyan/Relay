import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    meta: [
      {
        title: 'Relay | The Control Plane For AI Agents',
      },
    ],
  }),
})

const heroStats = [
  {
    label: 'State Layer',
    value: 'Local-first',
    caption: 'Keep sessions queryable in SQLite while syncing operators, agents, and services.',
  },
  {
    label: 'Operator Controls',
    value: 'Pause, redirect, handoff',
    caption: 'Intervene live without restarting the agent or losing context.',
  },
  {
    label: 'Auditability',
    value: 'Replay every step',
    caption: 'Inspect screenshots, reasoning, controls, and drift from one timeline.',
  },
] as const

const featureCards = [
  {
    title: 'One live feed for every agent',
    body: 'Track browser actions, screenshots, reasoning, and operator commands in the same session view.',
  },
  {
    title: 'Bring your own agent runtime',
    body: 'Use Relay as a sidecar control plane through the bridge API instead of rewriting your existing loop.',
  },
  {
    title: 'Human intervention without chaos',
    body: 'Pause, resume, redirect, and hand off work while preserving the exact execution trail.',
  },
  {
    title: 'Built for real workflows',
    body: 'Support, QA, operations, research, and browser automation all fit the same shared control model.',
  },
] as const

const steps = [
  {
    title: 'Connect an agent',
    body: 'Start a Relay session or bridge an external JS or Python agent into the local runtime.',
  },
  {
    title: 'Watch the session live',
    body: 'See actions, screenshots, structured reads, and reasoning appear in the feed as the run unfolds.',
  },
  {
    title: 'Steer the work in flight',
    body: 'Pause risky runs, redirect the objective, or stop execution the moment drift becomes visible.',
  },
  {
    title: 'Replay and hand off',
    body: 'Open timeline replay or handoff mode so another operator can continue with context intact.',
  },
] as const

const plans = [
  {
    tier: 'Open Source Core',
    price: '$0',
    note: 'Run Relay locally, track sessions, and bridge existing agents into a shared operator UI.',
    accent: false,
  },
  {
    tier: 'Team Control Plane',
    price: 'Custom',
    note: 'Layer in PowerSync-backed shared state, multi-device oversight, and durable ops workflows.',
    accent: true,
  },
] as const

const consoleSnapshot = [
  { label: 'Session', value: 'Support Triage Agent' },
  { label: 'Status', value: 'Running' },
  { label: 'Current goal', value: 'Verify refund on ticket #4821' },
  { label: 'Sync mode', value: 'Local-first bridge' },
] as const

const consoleEvents = [
  {
    tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    title: 'Agent read the inbox',
    detail: 'Grouped refunds, shipping delays, and escalation requests from the newest tickets.',
  },
  {
    tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    title: 'Operator redirected the task',
    detail: 'Changed the objective to refund verification without restarting the existing session.',
  },
  {
    tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    title: 'Relay prepared the handoff',
    detail: 'Timeline, screenshots, and reasoning stay attached so the next operator can continue immediately.',
  },
] as const

const consoleCapabilities = [
  {
    title: 'Operator controls',
    items: [
      'Pause or resume while the agent is running',
      'Redirect the objective in place',
      'Stop unsafe work before it spreads',
    ],
  },
  {
    title: 'Relay captures',
    items: [
      'Actions, screenshots, and structured reads',
      'Reasoning trail and latest session state',
      'Replay timeline and shareable handoff context',
    ],
  },
] as const

function LandingPage() {
  return (
    <main className="page-wrap landing-shell px-4 pb-10 pt-4">
      <section className="landing-hero island-shell rise-in overflow-hidden px-6 py-8 shadow-sm md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          <div>
            <p className="landing-kicker">Agent Operations, Without The Blind Spots</p>
            <h1 className="landing-title">
              The control plane for AI agents working in real products.
            </h1>
            <p className="landing-subtitle">
              Relay gives operators a live feed, session replay, redirects, handoffs, and bridge-based
              integration for external agents, all on top of a local-first state model built for real
              execution instead of static demos.
            </p>

            <div className="landing-cta">
              <Link to="/live" className="landing-btn landing-btn-primary">
                Open Live
              </Link>
              <Link to="/connect" className="landing-btn landing-btn-secondary">
                Connect An Agent
              </Link>
              <Link to="/timeline" className="landing-btn landing-btn-ghost">
                Replay Timeline
              </Link>
            </div>

            <div className="landing-stats">
              {heroStats.map((stat) => (
                <article key={stat.label} className="landing-stat-card">
                  <p className="landing-stat-label">{stat.label}</p>
                  <p className="landing-stat-value">{stat.value}</p>
                  <p className="landing-stat-caption">{stat.caption}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="island-shell relative overflow-hidden border border-cyan-500/20 bg-[var(--surface-strong)] p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="island-kicker mb-1 text-cyan-200">Session Snapshot</p>
                <p className="m-0 text-lg font-semibold text-zinc-50">What an operator actually sees in Relay</p>
              </div>
              <span className="inline-flex min-w-[4.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-emerald-300 [overflow-wrap:normal] [word-break:normal]">
                Live
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-700/80 bg-black/25 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {consoleSnapshot.map((item) => (
                    <div key={item.label} className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-3">
                      <p className="m-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        {item.label}
                      </p>
                      <p className="m-0 mt-2 text-sm font-semibold text-zinc-100">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-700/80 bg-black/25 p-4">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Recent events
                </p>
                <div className="mt-3 space-y-2.5">
                  {consoleEvents.map((event, index) => (
                    <div key={event.title} className="flex items-start gap-3">
                      <span className={`mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border text-[10px] font-bold ${event.tone}`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2.5">
                        <p className="m-0 text-sm font-semibold text-zinc-100">{event.title}</p>
                        <p className="m-0 mt-1 text-xs leading-relaxed text-zinc-400">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {consoleCapabilities.map((group) => (
                  <div key={group.title} className="rounded-xl border border-zinc-700/80 bg-black/25 p-4">
                    <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {group.title}
                    </p>
                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => (
                        <div key={item} className="rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs leading-relaxed text-zinc-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-8 rise-in stagger-1">
        <div className="landing-section-head">
          <p className="landing-section-kicker">Why teams use Relay</p>
          <h2>See the work, steer the work, and keep the context intact.</h2>
        </div>
        <div className="landing-feature-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rise-in stagger-2">
        <div className="landing-steps-shell">
          <div className="landing-section-head">
            <p className="landing-section-kicker">Workflow</p>
            <h2>From bridge launch to operator handoff in four clear steps.</h2>
          </div>
          <ol className="landing-steps-grid">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-step-card">
                <span className="landing-step-index">Step {index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-8 rise-in stagger-3">
        <div className="landing-pricing-shell">
          <div>
            <p className="landing-section-kicker">Packaging</p>
            <div className="landing-section-head">
              <h2>Start local, then layer on shared sync and operator workflows.</h2>
            </div>
            <p className="landing-pricing-copy">
              Relay works as a local operator console today and grows into a broader control plane when
              you need synced sessions, team visibility, and multi-device oversight. The point is not
              more dashboards. The point is fewer blind spots when agents start doing real work.
            </p>
          </div>

          <div className="landing-pricing-cards">
            {plans.map((plan) => (
              <article
                key={plan.tier}
                className={`landing-price-card ${plan.accent ? 'landing-price-card-accent' : ''}`}
              >
                <p className="landing-price-tier">{plan.tier}</p>
                <p className="landing-price-value">{plan.price}</p>
                <p className="landing-price-note">{plan.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="island-shell flex flex-col items-start justify-between gap-4 border border-blue-500/20 bg-blue-500/10 px-6 py-5 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="island-kicker mb-1 text-blue-300">Ready To Try It</p>
            <p className="m-0 text-lg font-semibold text-zinc-100">
              Open the live feed, connect an agent, or jump straight into handoff mode.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link to="/live" className="landing-btn landing-btn-primary">
              Live
            </Link>
            <Link to="/handoff" className="landing-btn landing-btn-secondary">
              Handoff View
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
