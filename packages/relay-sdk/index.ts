import { config as loadEnv } from 'dotenv'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PowerSyncDatabase,
  Schema,
  Table,
  column,
  type PowerSyncBackendConnector,
} from '@powersync/node'
import { Client } from 'pg'
import type { PowerSyncCredentials } from '@powersync/common'
import type { AgentActionType, AgentSessionStatus } from '@relay/shared'
import { RelaySqliteWriter } from './sqlite-writer'
import { RelayControlListener, type ControlCommandEvent } from './control-listener'
import { RelayDriftDetector } from './drift-detector'
import { RelayAgentWrapper } from './agent-wrapper'
import {
  createBrowserMemory,
  createPlaywrightDecisionExecutor,
  observePage,
} from './browser-agent'
import {
  getMaxMockWorkflowStepCount,
  isMockWorkflowName,
  planMockWorkflowDecision,
  type MockWorkflowName,
} from './mock-workflows'
import {
  runSampleAgentLoop,
  type AgentDecision,
  type DecisionExecutionResult,
} from './sample-agent'
import {
  capturePageScreenshotBase64,
  startPlaywrightCapture,
} from './screenshot'
import { setTimeout as sleep } from 'node:timers/promises'

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

// Prefer workspace root .env for monorepo runs, then fall back to local .env.
loadEnv({ path: resolve(__dirname, '../../.env') })
loadEnv()

type RelayWatchArgs = {
  task: string
  name: string
  agentId: string
  userId: string
  deviceName: string
  screenshotUrl: string | null
  screenshotIntervalMs: number
  headless: boolean
  workflow: MockWorkflowName | null
  dryRun: boolean
  bridge: boolean
  bridgePort: number
}

type BridgeActionInput = {
  type: AgentActionType
  title: string
  detail?: string
  screenshotB64?: string | null
  reasoning?: string
}

const BRIDGE_IDLE_HEARTBEAT_MS = 8000

function decodeJwtSubject(token: string | undefined | null): string | null {
  if (!token) {
    return null
  }

  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      sub?: unknown
    }
    return typeof payload.sub === 'string' && payload.sub.trim().length > 0
      ? payload.sub
      : null
  } catch {
    return null
  }
}

function resolveDefaultUserId(): string {
  return (
    decodeJwtSubject(process.env.RELAY_SESSION_TOKEN)
    ?? decodeJwtSubject(process.env.POWERSYNC_DEV_TOKEN)
    ?? decodeJwtSubject(process.env.VITE_POWERSYNC_DEV_TOKEN)
    ?? 'local-user'
  )
}

function parseArgs(argv: string[]): RelayWatchArgs {
  const argMap = new Map<string, string>()

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      argMap.set(key, 'true')
      continue
    }

    argMap.set(key, value)
    i += 1
  }

  const task = argMap.get('task') ?? 'Observe and control demo task'
  const name = argMap.get('name') ?? task
  const workflowArg = argMap.get('workflow')

  return {
    task,
    name,
    agentId: argMap.get('agent-id') ?? 'relay-sample-agent',
    userId: argMap.get('user-id') ?? resolveDefaultUserId(),
    deviceName: argMap.get('device-name') ?? 'Local Machine',
    screenshotUrl: argMap.get('screenshot-url') ?? null,
    screenshotIntervalMs: Number(argMap.get('screenshot-interval-ms') ?? '2000'),
    headless: argMap.get('headless') !== 'false',
    workflow: isMockWorkflowName(workflowArg) ? workflowArg : null,
    dryRun: argMap.get('dry-run') === 'true',
    bridge: argMap.get('bridge') === 'true',
    bridgePort: Number(argMap.get('bridge-port') ?? '8787'),
  }
}

const AGENT_ACTION_TYPES: AgentActionType[] = ['navigate', 'click', 'type', 'read', 'decide', 'wait', 'stop', 'redirect', 'resume', 'screenshot']

function isAgentActionType(value: unknown): value is AgentActionType {
  return typeof value === 'string' && AGENT_ACTION_TYPES.includes(value as AgentActionType)
}

function buildBridgePlaceholderScreenshotBase64(input: {
  task: string
  status: string
  detail: string
}): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="#0f172a"/>` +
    `<stop offset="100%" stop-color="#1e293b"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="1280" height="720" fill="url(#bg)"/>` +
    `<rect x="56" y="52" width="236" height="56" rx="16" fill="#14b8a6"/>` +
    `<text x="174" y="88" fill="#ecfeff" font-size="26" text-anchor="middle" font-family="Arial, sans-serif">Relay Bridge</text>` +
    `<text x="56" y="184" fill="#e2e8f0" font-size="24" font-family="Arial, sans-serif">Status</text>` +
    `<text x="56" y="236" fill="#f8fafc" font-size="42" font-family="Arial, sans-serif">${escapeXml(input.status)}</text>` +
    `<text x="56" y="326" fill="#94a3b8" font-size="24" font-family="Arial, sans-serif">Task</text>` +
    `<text x="56" y="378" fill="#e2e8f0" font-size="30" font-family="Arial, sans-serif">${escapeXml(input.task)}</text>` +
    `<text x="56" y="468" fill="#94a3b8" font-size="24" font-family="Arial, sans-serif">Detail</text>` +
    `<text x="56" y="520" fill="#cbd5e1" font-size="28" font-family="Arial, sans-serif">${escapeXml(input.detail)}</text>` +
    `</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    throw new Error('Request body is empty')
  }

  return JSON.parse(raw) as T
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

async function startBridgeApi(input: {
  writer: RelaySqliteWriter
  control: RelayControlListener
  sessionId: string
  port: number
  onExternalAction?: () => void
  onSessionStatusChange?: (status: AgentSessionStatus) => void
}): Promise<{ close: () => Promise<void> }> {
  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET'
    const requestUrl = new URL(req.url ?? '/', 'http://127.0.0.1')

    try {
      if (method === 'GET' && requestUrl.pathname === '/health') {
        writeJson(res, 200, { ok: true, mode: 'bridge', sessionId: input.sessionId })
        return
      }

      if (method === 'GET' && requestUrl.pathname === '/control') {
        const snapshot = input.control.snapshot()
        const consume = requestUrl.searchParams.get('consumeRedirect') === 'true'
        const redirectInstruction = consume
          ? input.control.consumeRedirectInstruction()
          : snapshot.redirectInstruction

        writeJson(res, 200, {
          paused: snapshot.paused,
          stopRequested: snapshot.stopRequested,
          redirectInstruction,
        })
        return
      }

      if (method === 'POST' && requestUrl.pathname === '/action') {
        const body = await readJsonBody<BridgeActionInput>(req)

        if (!isAgentActionType(body.type)) {
          writeJson(res, 400, { ok: false, error: 'Invalid action type' })
          return
        }

        if (!body.title || typeof body.title !== 'string') {
          writeJson(res, 400, { ok: false, error: 'title is required' })
          return
        }

        const actionId = await input.writer.logAction(
          body.type,
          body.title,
          typeof body.detail === 'string' ? body.detail : '',
          typeof body.screenshotB64 === 'string' ? body.screenshotB64 : null
        )

        input.onExternalAction?.()

        if (body.reasoning && typeof body.reasoning === 'string') {
          await input.writer.logReasoning(body.reasoning, actionId)
        }

        writeJson(res, 200, { ok: true, actionId })
        return
      }

      if (method === 'POST' && requestUrl.pathname === '/drift') {
        const body = await readJsonBody<{
          originalTask: string
          currentAction: string
          driftScore: number
          explanation: string
        }>(req)

        await input.writer.logDriftAlert(
          body.originalTask,
          body.currentAction,
          Number(body.driftScore),
          body.explanation
        )

        writeJson(res, 200, { ok: true })
        return
      }

      if (method === 'POST' && requestUrl.pathname === '/session/status') {
        const body = await readJsonBody<{ status: AgentSessionStatus }>(req)
        const status = body.status

        if (!['running', 'paused', 'stopped', 'completed'].includes(String(status))) {
          writeJson(res, 400, { ok: false, error: 'Invalid session status' })
          return
        }

        await input.writer.updateSessionStatus(status)
        input.onSessionStatusChange?.(status)
        writeJson(res, 200, { ok: true })
        return
      }

      writeJson(res, 404, { ok: false, error: 'Not found' })
    } catch (error) {
      writeJson(res, 500, { ok: false, error: String(error) })
    }
  })

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise)
    server.listen(input.port, '127.0.0.1', () => {
      server.off('error', rejectPromise)
      resolvePromise()
    })
  })

  console.log(`Bridge API listening on http://127.0.0.1:${input.port}`)
  console.log('POST /action, GET /control, GET /health, POST /drift, POST /session/status')

  return {
    close: async () => {
      await new Promise<void>((resolvePromise) => {
        server.close(() => resolvePromise())
      })
    },
  }
}

function createRelaySchema(): Schema {
  return new Schema({
    agent_sessions: new Table({
      name: column.text,
      agent_id: column.text,
      user_id: column.text,
      status: column.text,
      original_task: column.text,
      started_at: column.text,
      completed_at: column.text,
      device_name: column.text,
      share_token: column.text,
    }),
    agent_actions: new Table({
      session_id: column.text,
      type: column.text,
      title: column.text,
      detail: column.text,
      screenshot_b64: column.text,
      created_at: column.text,
      sequence_number: column.integer,
    }),
    agent_reasoning: new Table({
      session_id: column.text,
      action_id: column.text,
      thought: column.text,
      created_at: column.text,
    }),
    control_commands: new Table({
      session_id: column.text,
      command: column.text,
      payload: column.text,
      issued_by: column.text,
      issued_at: column.text,
      executed_at: column.text,
    }),
    drift_alerts: new Table({
      session_id: column.text,
      original_task: column.text,
      current_action: column.text,
      drift_score: column.real,
      explanation: column.text,
      created_at: column.text,
    }),
    watchers: new Table({
      session_id: column.text,
      user_id: column.text,
      device_type: column.text,
      joined_at: column.text,
      last_seen_at: column.text,
    }),
  })
}

function createConnector(): PowerSyncBackendConnector {
  return {
    fetchCredentials: async (): Promise<PowerSyncCredentials | null> => {
      const endpoint = process.env.POWERSYNC_URL
      const token = process.env.RELAY_SESSION_TOKEN

      if (!endpoint || !token) {
        return null
      }

      return {
        endpoint,
        token,
      }
    },
    uploadData: async (database) => {
      // PowerSync integration point: local writes are batched from SQLite and acknowledged.
      while (true) {
        const batch = await database.getCrudBatch(100)
        if (!batch) {
          return
        }

        // In production this batch is POSTed to backend; Phase 3 acknowledges locally.
        await batch.complete()
      }
    },
  }
}

export async function startRelayWatch(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)
  const sessionId = randomUUID()
  const relayDir = resolve(process.env.RELAY_DATA_DIR ?? '.relay-data')
  const sourceDatabaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

  let sourceClient: Client | null = null
  if (sourceDatabaseUrl) {
    try {
      sourceClient = new Client({ connectionString: sourceDatabaseUrl })
      await sourceClient.connect()
    } catch (error) {
      console.warn(`Source database unavailable. Continuing in local-only mode. ${String(error)}`)
      sourceClient = null
    }
  }

  await mkdir(relayDir, { recursive: true })

  const db = new PowerSyncDatabase({
    schema: createRelaySchema(),
    database: {
      dbFilename: 'relay.db',
      dbLocation: relayDir,
      implementation: {
        type: 'node:sqlite',
      },
    },
  })

  await db.init()

  const connector = createConnector()
  try {
    await db.connect(connector)
  } catch {
    // If remote sync credentials are absent, keep local-first mode active.
    console.warn('PowerSync remote connection unavailable. Running in local-only mode.')
  }

  const writer = new RelaySqliteWriter(db, sessionId, sourceClient)
  await writer.initializeSchema()
  await writer.createSession({
    name: args.name,
    agentId: args.agentId,
    userId: args.userId,
    originalTask: args.task,
    deviceName: args.deviceName,
  })

  const onCommandExecuted = async (event: ControlCommandEvent): Promise<void> => {
    if (event.command === 'pause') {
      await writer.updateSessionStatus('paused')
      await writer.logAction('wait', 'Paused by operator', `Issued by ${event.issuedBy}`)
      return
    }

    if (event.command === 'resume') {
      await writer.updateSessionStatus('running')
      await writer.logAction('resume', 'Resumed by operator', `Issued by ${event.issuedBy}`)
      return
    }

    if (event.command === 'stop') {
      await writer.updateSessionStatus('stopped')
      await writer.logAction('stop', 'Stop command queued', `Issued by ${event.issuedBy}`)
      return
    }

    if (event.command === 'redirect') {
      await writer.logAction(
        'redirect',
        'Redirect command received',
        event.payload ?? 'No redirect payload provided'
      )
    }
  }

  const control = new RelayControlListener(writer, 300, onCommandExecuted)
  const drift = new RelayDriftDetector(writer, args.task, 10)
  const relay = new RelayAgentWrapper(writer, control, drift)

  control.start()

  const firstAction = await relay.logAction(
    'decide',
    'Relay session started',
    `Started task: ${args.task}`
  )
  await relay.logReasoning('Initializing local observer and control loop.', firstAction)

  let stopBrowser: (() => Promise<void>) | null = null
  let captureForAgent: (() => Promise<string | null>) | undefined
  let observeForAgent: (() => Promise<string | null>) | undefined
  let executeDecisionForAgent:
    | ((decision: AgentDecision) => Promise<DecisionExecutionResult | void>)
    | undefined
  let planDecisionForAgent:
    | ((input: {
        task: string
        step: number
        screenshotB64: string | null
        observation: string | null
        fallbackWaitMs: number
      }) => Promise<AgentDecision>)
    | undefined

  if (args.screenshotUrl) {
    const browserMemory = createBrowserMemory()
    const { browser, page } = await startPlaywrightCapture(args.screenshotUrl, {
      headless: args.headless,
    })
    stopBrowser = async () => {
      await browser.close()
    }
    captureForAgent = async () => capturePageScreenshotBase64(page, 35)
    observeForAgent = async () => observePage(page, browserMemory)
    executeDecisionForAgent = createPlaywrightDecisionExecutor({
      page,
      initialUrl: args.screenshotUrl,
      captureScreenshot: captureForAgent,
      task: args.task,
      memory: browserMemory,
    })
  }

  if (args.workflow) {
    planDecisionForAgent = async (input) => planMockWorkflowDecision(args.workflow as MockWorkflowName, input)
  }

  console.log('Relay watch session started')
  console.log(`Session ID: ${sessionId}`)
  console.log(`SQLite path: ${resolve(relayDir, 'relay.db')}`)
  console.log('Control listener active: polling control_commands every 300ms')

  const shutdown = async (finalStatus: 'completed' | 'stopped' = 'completed') => {
    control.stop()
    await writer.completeSession(finalStatus)

    if (stopBrowser) {
      await stopBrowser()
    }

    await db.close()

    if (sourceClient) {
      await sourceClient.end()
      sourceClient = null
    }
  }

  if (args.dryRun) {
    const result = await runSampleAgentLoop({
      relay,
      initialTask: args.task,
      defaultWaitMs: args.screenshotIntervalMs,
      dryRun: true,
      maxSteps: 1,
      ...(captureForAgent ? { captureScreenshot: captureForAgent } : {}),
      ...(observeForAgent ? { observe: observeForAgent } : {}),
      ...(planDecisionForAgent ? { planDecision: planDecisionForAgent } : {}),
      ...(executeDecisionForAgent ? { applyDecision: executeDecisionForAgent } : {}),
    })
    await relay.logAction('wait', 'Dry run complete', `Sample loop result: ${result}`)
    await shutdown('completed')
    return
  }

  if (args.bridge) {
    await relay.logAction(
      'read',
      'Bridge mode enabled',
      `Accepting external agent events on localhost:${args.bridgePort}`
    )

    const startupScreenshotAction = await relay.logAction(
      'screenshot',
      'Bridge waiting for external agent',
      'No external actions received yet. Relay is listening for POST /action events.',
      buildBridgePlaceholderScreenshotBase64({
        task: args.task,
        status: 'Waiting for first agent event',
        detail: `POST actions to localhost:${args.bridgePort}/action`,
      })
    )
    await relay.logReasoning(
      'Bridge mode is active. Rendering a placeholder live screen until the first external event arrives.',
      startupScreenshotAction
    )

    let interrupted = false
    let bridgeSessionStatus: AgentSessionStatus = 'running'
    let lastExternalActionAt = Date.now()
    let lastHeartbeatAt = Date.now()
    const bridge = await startBridgeApi({
      writer,
      control,
      sessionId,
      port: args.bridgePort,
      onExternalAction: () => {
        lastExternalActionAt = Date.now()
      },
      onSessionStatusChange: (status) => {
        bridgeSessionStatus = status

        if (status === 'running') {
          lastExternalActionAt = Date.now()
          lastHeartbeatAt = Date.now()
        }
      },
    })

    const onSignal = () => {
      interrupted = true
    }

    process.on('SIGINT', onSignal)
    process.on('SIGTERM', onSignal)

    while (!interrupted) {
      const snapshot = control.snapshot()
      if (snapshot.stopRequested || isTerminalBridgeSessionStatus(bridgeSessionStatus)) {
        break
      }

      if (snapshot.paused || isPausedBridgeSessionStatus(bridgeSessionStatus)) {
        await sleep(300)
        continue
      }

      const now = Date.now()
      const idleForMs = now - lastExternalActionAt
      if (
        idleForMs >= BRIDGE_IDLE_HEARTBEAT_MS &&
        now - lastHeartbeatAt >= BRIDGE_IDLE_HEARTBEAT_MS
      ) {
        lastHeartbeatAt = now
        await relay.logAction(
          'wait',
          'Awaiting external agent event',
          `Bridge idle for ${Math.floor(idleForMs / 1000)}s on localhost:${args.bridgePort}`
        )
      }

      await sleep(300)
    }

    await bridge.close()

    if (interrupted) {
      await relay.logAction('stop', 'Bridge shutdown requested', 'Received interrupt signal')
      await shutdown('stopped')
      process.exit(0)
    }

    await shutdown(getBridgeShutdownStatus(bridgeSessionStatus))
    return
  }

  const onSigint = async () => {
    await relay.logAction('stop', 'Shutdown requested', 'Received interrupt signal')
    await shutdown('stopped')
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void onSigint()
  })

  const result = await runSampleAgentLoop({
    relay,
    initialTask: args.task,
    defaultWaitMs: args.screenshotIntervalMs,
    ...(args.workflow ? { maxSteps: getMaxMockWorkflowStepCount() + 1 } : {}),
    ...(captureForAgent ? { captureScreenshot: captureForAgent } : {}),
    ...(observeForAgent ? { observe: observeForAgent } : {}),
    ...(planDecisionForAgent ? { planDecision: planDecisionForAgent } : {}),
    ...(executeDecisionForAgent ? { applyDecision: executeDecisionForAgent } : {}),
  })

  await shutdown(
    result === 'stop-requested' || result === 'browser-closed'
      ? 'stopped'
      : 'completed'
  )
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false

if (isDirectRun) {
  void startRelayWatch().catch((error: unknown) => {
    console.error('relay-watch failed:', error)
    process.exit(1)
  })
}

function isTerminalBridgeSessionStatus(status: AgentSessionStatus): boolean {
  return status === 'stopped' || status === 'completed'
}

function isPausedBridgeSessionStatus(status: AgentSessionStatus): boolean {
  return status === 'paused'
}

function getBridgeShutdownStatus(
  status: AgentSessionStatus
): 'completed' | 'stopped' {
  return status === 'completed' ? 'completed' : 'stopped'
}
