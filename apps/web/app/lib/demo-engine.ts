import {
  disconnectRelayPowerSync,
  ensureRelayPowerSyncConnected,
  relayPowerSyncDb,
} from './powersync'

type DemoScenario = {
  type: 'navigate' | 'click' | 'type' | 'read' | 'decide' | 'wait'
  title: string
  detail: string
  reasoning: string
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    type: 'navigate',
    title: 'Open travel dashboard',
    detail: 'Loaded the trip planning workspace and account context.',
    reasoning: 'Need a stable baseline before booking flow begins.',
  },
  {
    type: 'type',
    title: 'Set destination to Lisbon',
    detail: 'Entered Lisbon for a 3-night weekend itinerary.',
    reasoning: 'User preference from prior history points to Lisbon.',
  },
  {
    type: 'click',
    title: 'Filter hotels by walkability',
    detail: 'Applied central district and high walkability filters.',
    reasoning: 'Reduces decision space and keeps choices realistic.',
  },
  {
    type: 'read',
    title: 'Compare refund policies',
    detail: 'Parsed cancellation terms for the top 5 options.',
    reasoning: 'Trip flexibility has higher priority than minimal price.',
  },
  {
    type: 'decide',
    title: 'Select preferred hotel',
    detail: 'Chose Boutique Alfama Stay based on score matrix.',
    reasoning: 'Balanced cost, location, and cancellation risk best.',
  },
  {
    type: 'navigate',
    title: 'Move to checkout review',
    detail: 'Opened checkout summary and verified taxes and fees.',
    reasoning: 'Final validation step before confirmation.',
  },
]

export async function ensureDemoSession(existingSessionId: string | null): Promise<string> {
  const sessionId = existingSessionId ?? crypto.randomUUID()

  const found = await relayPowerSyncDb.getOptional<{ id: string }>(
    'SELECT id FROM agent_sessions WHERE id = ? LIMIT 1',
    [sessionId]
  )

  if (!found) {
    await relayPowerSyncDb.execute(
      `
        INSERT INTO agent_sessions (
          id,
          name,
          agent_id,
          user_id,
          status,
          original_task,
          started_at,
          completed_at,
          device_name,
          share_token
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sessionId,
        'Demo Mode Session',
        'relay-demo-agent',
        'demo-user',
        'running',
        'Plan and validate a weekend travel booking end-to-end',
        new Date().toISOString(),
        null,
        'Demo Machine',
        null,
      ]
    )

    await relayPowerSyncDb.execute(
      `
        INSERT OR REPLACE INTO watchers (
          session_id,
          user_id,
          device_type,
          joined_at,
          last_seen_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [sessionId, 'judge-viewer', 'desktop', new Date().toISOString(), new Date().toISOString()]
    )
  }

  return sessionId
}

export async function setDemoOfflineState(offline: boolean): Promise<void> {
  if (offline) {
    await disconnectRelayPowerSync()
    return
  }

  await ensureRelayPowerSyncConnected()
}

export async function runDemoSimulationStep(input: {
  sessionId: string
  step: number
  offline: boolean
}): Promise<{
  nextStep: number
  writes: number
  title: string
}> {
  const scenario = DEMO_SCENARIOS[input.step % DEMO_SCENARIOS.length]
  const createdAt = new Date().toISOString()
  const actionId = crypto.randomUUID()
  const reasoningId = crypto.randomUUID()
  const sequenceNumber = await getNextSequenceNumber(input.sessionId)

  await relayPowerSyncDb.execute(
    `
      INSERT INTO agent_actions (
        id,
        session_id,
        type,
        title,
        detail,
        screenshot_b64,
        created_at,
        sequence_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      actionId,
      input.sessionId,
      scenario.type,
      scenario.title,
      scenario.detail,
      buildScreenshotBase64(scenario.title, input.step, input.offline),
      createdAt,
      sequenceNumber,
    ]
  )

  await relayPowerSyncDb.execute(
    `
      INSERT INTO agent_reasoning (
        id,
        session_id,
        action_id,
        thought,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [reasoningId, input.sessionId, actionId, scenario.reasoning, createdAt]
  )

  await relayPowerSyncDb.execute(
    'UPDATE watchers SET last_seen_at = ? WHERE session_id = ? AND user_id = ?',
    [createdAt, input.sessionId, 'judge-viewer']
  )

  if (input.step > 0 && input.step % 5 === 0) {
    await relayPowerSyncDb.execute(
      `
        INSERT INTO drift_alerts (
          id,
          session_id,
          original_task,
          current_action,
          drift_score,
          explanation,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        crypto.randomUUID(),
        input.sessionId,
        'Plan and validate a weekend travel booking end-to-end',
        `${scenario.type}: ${scenario.title}`,
        0.18,
        'Minor detour into filter tuning, still aligned to booking objective.',
        createdAt,
      ]
    )
  }

  return {
    nextStep: input.step + 1,
    writes: 3,
    title: scenario.title,
  }
}

async function getNextSequenceNumber(sessionId: string): Promise<number> {
  const row = await relayPowerSyncDb.getOptional<{ next_sequence: number }>(
    'SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence FROM agent_actions WHERE session_id = ?',
    [sessionId]
  )

  return row?.next_sequence ?? 1
}

function buildScreenshotBase64(title: string, step: number, offline: boolean): string {
  const status = offline ? 'OFFLINE' : 'LIVE'
  const color = offline ? '#ef4444' : '#10b981'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0f172a"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="1200" height="675" fill="url(#g)"/><rect x="40" y="40" width="200" height="56" rx="12" fill="${color}"/><text x="140" y="76" fill="#ffffff" font-size="24" text-anchor="middle" font-family="Arial">${status}</text><text x="60" y="170" fill="#e5e7eb" font-size="34" font-family="Arial">Step ${step + 1}</text><text x="60" y="230" fill="#f9fafb" font-size="44" font-family="Arial">${escapeXml(title)}</text></svg>`

  const bytes = new TextEncoder().encode(svg)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return `data:image/svg+xml;base64,${btoa(binary)}`
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
