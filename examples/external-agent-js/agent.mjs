const bridgeUrl = process.env.RELAY_BRIDGE_URL ?? 'http://127.0.0.1:8787'
let task =
  process.env.RELAY_TASK ??
  'Review the newest support tickets, flag urgent cases, and draft a summary.'

const steps = [
  {
    type: 'navigate',
    title: 'Opened support inbox',
    detail: 'Loaded the newest tickets for triage.',
  },
  {
    type: 'read',
    title: 'Read urgent tickets',
    detail: 'Grouped refunds, shipping issues, and escalation requests.',
  },
  {
    type: 'decide',
    title: 'Prepared response plan',
    detail: 'Compiled the next work queue for the operator.',
  },
]

await request('/health')
await request('/session/status', { status: 'running' })

for (const step of steps) {
  let control = await request('/control?consumeRedirect=true')

  if (control.redirectInstruction) {
    task = control.redirectInstruction
    await request('/action', {
      type: 'redirect',
      title: 'Redirect received from Relay',
      detail: task,
      reasoning: 'Switching to the new operator-provided objective.',
    })
  }

  while (control.paused && !control.stopRequested) {
    await request('/session/status', { status: 'paused' })
    console.log('Relay paused the agent. Waiting for resume...')
    await sleep(1000)
    control = await request('/control?consumeRedirect=true')
  }

  if (control.stopRequested) {
    console.log('Relay requested stop. Exiting.')
    await request('/session/status', { status: 'stopped' })
    process.exit(0)
  }

  await request('/session/status', { status: 'running' })
  await request('/action', {
    ...step,
    reasoning: `Current task: ${task}`,
  })
  await sleep(1200)
}

await request('/session/status', { status: 'completed' })
console.log('Demo agent finished successfully.')

async function request(path, payload) {
  const response = await fetch(`${bridgeUrl}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  })

  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null

  if (!response.ok) {
    throw new Error(data?.error ?? `Bridge request failed with ${response.status}`)
  }

  return data
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
