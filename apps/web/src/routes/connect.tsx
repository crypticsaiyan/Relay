import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
})

type ConnectFormState = {
  agentName: string
  agentId: string
  task: string
  userId: string
  port: string
}

const INITIAL_FORM_STATE: ConnectFormState = {
  agentName: 'Support Triage Agent',
  agentId: 'support-triage-agent',
  task: 'Review the newest support tickets, flag urgent cases, and draft a summary.',
  userId: 'demo_user',
  port: '8787',
}

function ConnectPage() {
  const [form, setForm] = useState<ConnectFormState>(INITIAL_FORM_STATE)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const bridgeUrl = `http://127.0.0.1:${sanitizePort(form.port)}`
  const relayUiUrl =
    typeof window === 'undefined' ? 'http://localhost:3000/live' : `${window.location.origin}/live`

  const launchCommand = buildLaunchCommand(form)
  const helperSnippet = buildHelperClientSnippet({ ...form, bridgeUrl })
  const pythonSnippet = buildPythonSnippet({ ...form, bridgeUrl })
  const curlSnippet = buildCurlSnippet({ ...form, bridgeUrl })

  const copyText = async (label: string, value: string): Promise<void> => {
    try {
      setError('')
      await navigator.clipboard.writeText(value)
      setStatus(`${label} copied to clipboard.`)
    } catch (cause) {
      setError(`Copy failed: ${String(cause)}`)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm md:p-8">
        <p className="island-kicker mb-2">Relay Connect</p>
        <h1 className="display-title text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
          Connect An Existing Agent
        </h1>
        <p className="m-0 mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Relay already has the bridge runtime. This page turns it into an onboarding
          interface: start a bridge session, point your agent at the local bridge URL,
          and let Relay track actions, reasoning, pauses, redirects, and final status.
        </p>
      </section>

      {error && (
        <section className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-sm">
          {error}
        </section>
      )}

      {status && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 shadow-sm">
          {status}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="island-shell bg-[var(--surface-strong)] p-5 shadow-sm lg:col-span-4">
          <p className="island-kicker mb-4">Session Setup</p>
          <div className="space-y-4">
            <Field
              label="Agent Name"
              value={form.agentName}
              onChange={(value) => setForm((previous) => ({ ...previous, agentName: value }))}
            />
            <Field
              label="Agent Id"
              value={form.agentId}
              onChange={(value) => setForm((previous) => ({ ...previous, agentId: slugify(value) }))}
            />
            <Field
              label="Task"
              value={form.task}
              onChange={(value) => setForm((previous) => ({ ...previous, task: value }))}
            />
            <Field
              label="User Id"
              value={form.userId}
              onChange={(value) => setForm((previous) => ({ ...previous, userId: value }))}
            />
            <Field
              label="Bridge Port"
              value={form.port}
              onChange={(value) =>
                setForm((previous) => ({ ...previous, port: value.replace(/[^\d]/g, '') || '8787' }))
              }
            />
          </div>

          <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs text-zinc-300">
            <p className="m-0 font-semibold text-zinc-100">Generated Bridge URL</p>
            <p className="m-0 mt-2 font-mono text-zinc-400">{bridgeUrl}</p>
            <p className="m-0 mt-4 font-semibold text-zinc-100">Relay UI</p>
            <p className="m-0 mt-2 font-mono text-zinc-400">{relayUiUrl}</p>
          </div>

          <div className="mt-5 space-y-3">
            <StepCard
              number="1"
              title="Start the bridge session"
              detail="This creates the Relay-tracked session and opens the local HTTP bridge your agent will talk to."
            />
            <StepCard
              number="2"
              title="Point your agent at the bridge URL"
              detail="Post actions and reasoning to Relay, and poll controls so pause, stop, and redirect work."
            />
            <StepCard
              number="3"
              title="Watch and control it in Relay"
              detail="Open the live feed, timeline, or handoff route while the agent keeps running in its own process."
            />
          </div>
        </article>

        <article className="lg:col-span-8 space-y-6">
          <SnippetCard
            title="1. Launch Relay In Bridge Mode"
            description="Run this in a terminal before starting the external agent."
            code={launchCommand}
            onCopy={() => {
              void copyText('Launch command', launchCommand)
            }}
          />

          <SnippetCard
            title="2. JavaScript / TypeScript Agent"
            description="Use the helper client from this repo if your agent lives in the Relay workspace or you vendor the client into your own project."
            code={helperSnippet}
            onCopy={() => {
              void copyText('JavaScript example', helperSnippet)
            }}
          />

          <SnippetCard
            title="3. Python Agent"
            description="This uses only the standard library, so it works without extra dependencies."
            code={pythonSnippet}
            onCopy={() => {
              void copyText('Python example', pythonSnippet)
            }}
          />

          <SnippetCard
            title="4. Smoke Test With cURL"
            description="Use this to confirm the bridge is alive before integrating a full agent loop."
            code={curlSnippet}
            onCopy={() => {
              void copyText('cURL smoke test', curlSnippet)
            }}
          />

          <div className="island-shell bg-[var(--surface-strong)] p-5 shadow-sm">
            <p className="island-kicker mb-3">Bridge Contract</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <EndpointCard method="GET" path="/health" detail="Check that the local Relay bridge is running." />
              <EndpointCard method="POST" path="/action" detail="Send a tracked action plus optional reasoning and screenshot." />
              <EndpointCard method="GET" path="/control?consumeRedirect=true" detail="Poll pause/stop state and consume the newest redirect instruction." />
              <EndpointCard method="POST" path="/session/status" detail="Set the session to running, paused, stopped, or completed." />
              <EndpointCard method="POST" path="/drift" detail="Report drift or safety signals back into Relay." />
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

function Field(input: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {input.label}
      </span>
      <input
        value={input.value}
        onChange={(event) => input.onChange(event.target.value)}
        className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-sm font-mono text-zinc-200 outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </label>
  )
}

function StepCard(input: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 shadow-sm">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Step {input.number}
      </p>
      <p className="m-0 mt-2 text-sm font-semibold text-zinc-100">{input.title}</p>
      <p className="m-0 mt-2 text-xs leading-relaxed text-zinc-400">{input.detail}</p>
    </div>
  )
}

function SnippetCard(input: {
  title: string
  description: string
  code: string
  onCopy: () => void
}) {
  return (
    <div className="island-shell bg-[var(--surface-strong)] p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="island-kicker mb-1">{input.title}</p>
          <p className="m-0 text-sm leading-relaxed text-zinc-400">{input.description}</p>
        </div>
        <button
          className="rounded-md border border-[var(--line)] bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-all hover:bg-zinc-700"
          onClick={input.onCopy}
        >
          Copy
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs leading-relaxed text-zinc-300 shadow-inner">
        <code>{input.code}</code>
      </pre>
    </div>
  )
}

function EndpointCard(input: { method: string; path: string; detail: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {input.method}
      </p>
      <p className="m-0 mt-2 font-mono text-sm text-zinc-100">{input.path}</p>
      <p className="m-0 mt-2 text-xs leading-relaxed text-zinc-400">{input.detail}</p>
    </div>
  )
}

function sanitizePort(value: string): string {
  const normalized = value.replace(/[^\d]/g, '')
  return normalized.length > 0 ? normalized : '8787'
}

function shellEscape(input: string): string {
  return `"${input.replace(/(["\\$`])/g, '\\$1')}"`
}

function slugify(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'relay-agent'
}

function buildLaunchCommand(form: ConnectFormState): string {
  return [
    'pnpm --filter @relay/relay-sdk relay-watch \\',
    `  --name ${shellEscape(form.agentName)} \\`,
    `  --agent-id ${shellEscape(slugify(form.agentId))} \\`,
    `  --task ${shellEscape(form.task)} \\`,
    `  --user-id ${shellEscape(form.userId)} \\`,
    '  --bridge true \\',
    `  --bridge-port ${sanitizePort(form.port)}`,
  ].join('\n')
}

function buildHelperClientSnippet(input: ConnectFormState & { bridgeUrl: string }): string {
  return [
    "import { RelayBridgeClient } from '@relay/relay-sdk/bridge-client'",
    '',
    `const relay = new RelayBridgeClient({ baseUrl: '${input.bridgeUrl}' })`,
    `let task = \`${escapeTemplateLiteral(input.task)}\``,
    '',
    'const steps = [',
    "  { type: 'navigate', title: 'Opened support inbox', detail: 'Loaded the ticket queue.' },",
    "  { type: 'read', title: 'Read newest tickets', detail: 'Flagged urgent messages and grouped refund issues.' },",
    "  { type: 'decide', title: 'Prepared response plan', detail: 'Drafted the next operator summary.' },",
    ']',
    '',
    'await relay.health()',
    "await relay.status('running')",
    '',
    'for (const step of steps) {',
    '  const control = await relay.control({ consumeRedirect: true })',
    '  if (control.stopRequested) break',
    '',
    '  if (control.redirectInstruction) {',
    '    task = control.redirectInstruction',
    '    await relay.action({',
    "      type: 'redirect',",
    "      title: 'Redirect received from Relay',",
    '      detail: task,',
    "      reasoning: 'Switching to the new operator-provided objective.',",
    '    })',
    '  }',
    '',
    '  if (control.paused) {',
    "    await relay.status('paused')",
    '    const resume = await relay.waitWhilePaused({ pollMs: 1000 })',
    '    if (resume.stopRequested) break',
    "    await relay.status('running')",
    '  }',
    '',
    '  await relay.action({',
    '    ...step,',
    "    reasoning: `Current task: ${task}`",
    '  })',
    '',
    '  await new Promise((resolve) => setTimeout(resolve, 1200))',
    '}',
    '',
    "await relay.status('completed')",
  ].join('\n')
}

function buildPythonSnippet(input: ConnectFormState & { bridgeUrl: string }): string {
  return [
    'import json',
    'import time',
    'import urllib.request',
    '',
    `BASE_URL = "${input.bridgeUrl}"`,
    `task = "${escapePythonString(input.task)}"`,
    '',
    'def request(path, payload=None):',
    '    body = None if payload is None else json.dumps(payload).encode("utf-8")',
    '    req = urllib.request.Request(',
    '        f"{BASE_URL}{path}",',
    '        data=body,',
    '        headers={"Content-Type": "application/json"},',
    '        method="POST" if payload is not None else "GET",',
    '    )',
    '    with urllib.request.urlopen(req) as response:',
    '        raw = response.read().decode("utf-8")',
    '        return json.loads(raw) if raw else None',
    '',
    'request("/health")',
    'request("/session/status", {"status": "running"})',
    '',
    'steps = [',
    '    {"type": "navigate", "title": "Opened support inbox", "detail": "Loaded the ticket queue."},',
    '    {"type": "read", "title": "Read newest tickets", "detail": "Flagged urgent messages and grouped refund issues."},',
    '    {"type": "decide", "title": "Prepared response plan", "detail": "Drafted the next operator summary."},',
    ']',
    '',
    'for step in steps:',
    '    control = request("/control?consumeRedirect=true")',
    '    if control["stopRequested"]:',
    '        break',
    '',
    '    if control["redirectInstruction"]:',
    '        task = control["redirectInstruction"]',
    '        request("/action", {',
    '            "type": "redirect",',
    '            "title": "Redirect received from Relay",',
    '            "detail": task,',
    '            "reasoning": "Switching to the new operator-provided objective.",',
    '        })',
    '',
    '    while control["paused"] and not control["stopRequested"]:',
    '        request("/session/status", {"status": "paused"})',
    '        time.sleep(1.0)',
    '        control = request("/control?consumeRedirect=true")',
    '',
    '    if control["stopRequested"]:',
    '        break',
    '',
    '    request("/session/status", {"status": "running"})',
    '    request("/action", {',
    '        **step,',
    '        "reasoning": f"Current task: {task}",',
    '    })',
    '    time.sleep(1.2)',
    '',
    'request("/session/status", {"status": "completed"})',
  ].join('\n')
}

function buildCurlSnippet(input: ConnectFormState & { bridgeUrl: string }): string {
  return [
    `curl ${input.bridgeUrl}/health`,
    '',
    `curl -X POST ${input.bridgeUrl}/action \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{`,
    `    "type": "read",`,
    `    "title": "Connected external agent",`,
    `    "detail": "The external agent is now reporting into Relay.",`,
    `    "reasoning": "Smoke test for the bridge contract."`,
    `  }'`,
    '',
    `curl "${input.bridgeUrl}/control?consumeRedirect=true"`,
  ].join('\n')
}

function escapeTemplateLiteral(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function escapePythonString(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
