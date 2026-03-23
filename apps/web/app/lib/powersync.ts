import { PowerSyncDatabase } from '@powersync/web'
import { Schema, Table, column, type QueryResult } from '@powersync/common'
import type { AgentAction, AgentSession, ControlCommand } from '@relay/shared'
import { createRelayPowerSyncConnector } from './powersync-connector'
import { getRelaySourceStats, upsertRemoteWatcher } from './powersync-server'

export type AgentReasoningRow = {
  id: string
  session_id: string
  action_id: string
  thought: string
  created_at: string
}

export type DriftAlertRow = {
  id: string
  session_id: string
  original_task: string
  current_action: string
  drift_score: number
  explanation: string
  created_at: string
}

export type WatcherRow = {
  session_id: string
  user_id: string
  device_type: string
  joined_at: string
  last_seen_at: string
}

export type RecentSessionRow = AgentSession & {
  last_activity_at?: string | null
}

export type RelayPowerSyncConnectionSnapshot = {
  status: 'idle' | 'connecting' | 'live' | 'offline'
  error: string | null
}

const relaySchema = new Schema({
  agent_sessions: new Table(
    {
      name: column.text,
      agent_id: column.text,
      user_id: column.text,
      status: column.text,
      original_task: column.text,
      started_at: column.text,
      completed_at: column.text,
      device_name: column.text,
      share_token: column.text,
    },
    {
      indexes: {
        sessionsByUser: ['user_id'],
      },
    }
  ),
  agent_actions: new Table(
    {
      session_id: column.text,
      type: column.text,
      title: column.text,
      detail: column.text,
      screenshot_b64: column.text,
      created_at: column.text,
      sequence_number: column.integer,
    },
    {
      indexes: {
        actionsBySession: ['session_id', 'sequence_number'],
      },
    }
  ),
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
  watchers: new Table(
    {
      session_id: column.text,
      user_id: column.text,
      device_type: column.text,
      joined_at: column.text,
      last_seen_at: column.text,
    },
    {
      indexes: {
        watchersBySession: ['session_id'],
      },
    }
  ),
})

export const relayPowerSyncDb = new PowerSyncDatabase({
  schema: relaySchema,
  database: {
    dbFilename: 'relay-web.db',
  },
})

const relayConnector = createRelayPowerSyncConnector()
let connectPromise: Promise<void> | null = null
let sourceCacheChecked = false
let connectionSnapshot: RelayPowerSyncConnectionSnapshot = {
  status: 'idle',
  error: null,
}
const connectionListeners = new Set<(snapshot: RelayPowerSyncConnectionSnapshot) => void>()

function publishConnectionSnapshot(next: RelayPowerSyncConnectionSnapshot): void {
  connectionSnapshot = next

  for (const listener of connectionListeners) {
    listener(connectionSnapshot)
  }
}

export function getRelayPowerSyncConnectionSnapshot(): RelayPowerSyncConnectionSnapshot {
  return connectionSnapshot
}

export function watchRelayPowerSyncConnection(
  onSnapshot: (snapshot: RelayPowerSyncConnectionSnapshot) => void
): () => void {
  connectionListeners.add(onSnapshot)
  onSnapshot(connectionSnapshot)

  return () => {
    connectionListeners.delete(onSnapshot)
  }
}

async function connectRelayPowerSync(): Promise<void> {
  if (!connectPromise) {
    publishConnectionSnapshot({
      status: 'connecting',
      error: null,
    })
    connectPromise = relayPowerSyncDb.connect(relayConnector).catch((error: unknown) => {
      connectPromise = null
      publishConnectionSnapshot({
        status: 'offline',
        error: String(error),
      })
      throw error
    })
  }

  await connectPromise
  publishConnectionSnapshot({
    status: 'live',
    error: null,
  })
}

async function reconcileBrowserCacheWithSource(): Promise<void> {
  const [sourceStats, localStats] = await Promise.all([
    getRelaySourceStats(),
    relayPowerSyncDb.getOptional<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM agent_sessions'
    ),
  ])

  const localSessionCount = localStats?.count ?? 0
  if (sourceStats.agent_sessions === 0 && localSessionCount > 0) {
    await relayPowerSyncDb.disconnectAndClear()
    connectPromise = null
    await connectRelayPowerSync()
  }
}

export async function ensureRelayPowerSyncConnected(): Promise<void> {
  // PowerSync integration point: start one sync loop and keep it running in background.
  await connectRelayPowerSync()

  if (!sourceCacheChecked) {
    sourceCacheChecked = true
    await reconcileBrowserCacheWithSource()
  }
}

export async function disconnectRelayPowerSync(): Promise<void> {
  await relayPowerSyncDb.disconnect()
  connectPromise = null
  sourceCacheChecked = false
  publishConnectionSnapshot({
    status: 'idle',
    error: null,
  })
}

function toArrayRows<T>(queryResult: QueryResult): T[] {
  const rowsObject = queryResult.rows
  if (!rowsObject || !('_array' in rowsObject)) {
    return []
  }

  return rowsObject._array as T[]
}

export function watchSqlRows<T>(
  sql: string,
  params: unknown[],
  onRows: (rows: T[]) => void
): () => void {
  let cancelled = false

  // PowerSync integration point: db.watch streams local SQLite updates reactively.
  const consume = async () => {
    for await (const result of relayPowerSyncDb.watch(sql, params, {
      triggerImmediate: true,
    })) {
      if (cancelled) {
        break
      }

      onRows(toArrayRows<T>(result))
    }
  }

  void consume()

  return () => {
    cancelled = true
  }
}

export function watchSessionActions(
  sessionId: string,
  onRows: (rows: AgentAction[]) => void
): () => void {
  return watchSqlRows<AgentAction>(
    `
      SELECT *
      FROM agent_actions
      WHERE session_id = ?
      ORDER BY sequence_number ASC
    `,
    [sessionId],
    onRows
  )
}

export function watchSessionInfo(
  sessionId: string,
  onRows: (rows: AgentSession[]) => void
): () => void {
  return watchSqlRows<AgentSession>(
    `
      SELECT *
      FROM agent_sessions
      WHERE id = ?
      LIMIT 1
    `,
    [sessionId],
    onRows
  )
}

export function watchControlCommands(
  sessionId: string,
  onRows: (rows: ControlCommand[]) => void
): () => void {
  return watchSqlRows<ControlCommand>(
    `
      SELECT *
      FROM control_commands
      WHERE session_id = ?
      ORDER BY issued_at DESC
    `,
    [sessionId],
    onRows
  )
}

export function watchRecentSessions(
  onRows: (rows: RecentSessionRow[]) => void,
  limit = 20
): () => void {
  return watchSqlRows<RecentSessionRow>(
    `
      SELECT
        agent_sessions.*,
        COALESCE(
          (
            SELECT MAX(actions.created_at)
            FROM agent_actions AS actions
            WHERE actions.session_id = agent_sessions.id
          ),
          started_at
        ) AS last_activity_at
      FROM agent_sessions
      ORDER BY
        CASE LOWER(TRIM(COALESCE(status, '')))
          WHEN 'running' THEN 0
          WHEN 'paused' THEN 1
          ELSE 2
        END,
        COALESCE(
          (
            SELECT MAX(actions.created_at)
            FROM agent_actions AS actions
            WHERE actions.session_id = agent_sessions.id
          ),
          started_at
        ) DESC,
        started_at DESC
      LIMIT ?
    `,
    [limit],
    onRows
  )
}

export function watchSessionReasoning(
  sessionId: string,
  onRows: (rows: AgentReasoningRow[]) => void
): () => void {
  return watchSqlRows<AgentReasoningRow>(
    `
      SELECT *
      FROM agent_reasoning
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [sessionId],
    onRows
  )
}

export function watchSessionDriftAlerts(
  sessionId: string,
  onRows: (rows: DriftAlertRow[]) => void
): () => void {
  return watchSqlRows<DriftAlertRow>(
    `
      SELECT *
      FROM drift_alerts
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [sessionId],
    onRows
  )
}

export function watchSessionWatchers(
  sessionId: string,
  onRows: (rows: WatcherRow[]) => void
): () => void {
  return watchSqlRows<WatcherRow>(
    `
      SELECT *
      FROM watchers
      WHERE session_id = ?
      ORDER BY last_seen_at DESC
    `,
    [sessionId],
    onRows
  )
}

export async function issueControlCommand(input: {
  sessionId: string
  command: 'pause' | 'resume' | 'stop' | 'redirect'
  payload?: string | null
  issuedBy: string
}): Promise<void> {
  const issuedAt = new Date().toISOString()

  await relayPowerSyncDb.execute(
    `
      INSERT INTO control_commands (
        id,
        session_id,
        command,
        payload,
        issued_by,
        issued_at,
        executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      crypto.randomUUID(),
      input.sessionId,
      input.command,
      input.payload ?? null,
      input.issuedBy,
      issuedAt,
      null,
    ]
  )

  const optimisticStatus = getOptimisticStatusForControlCommand(input.command)
  if (optimisticStatus) {
    await relayPowerSyncDb.execute(
      'UPDATE agent_sessions SET status = ? WHERE id = ?',
      [optimisticStatus, input.sessionId]
    )
  }
}

export async function setSessionShareToken(input: {
  sessionId: string
  shareToken: string | null
}): Promise<void> {
  await relayPowerSyncDb.execute(
    'UPDATE agent_sessions SET share_token = ? WHERE id = ?',
    [input.shareToken, input.sessionId]
  )
}

export async function upsertSessionWatcher(input: {
  sessionId: string
  userId: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
}): Promise<void> {
  await upsertRemoteWatcher({
    data: input,
  })
}

function getOptimisticStatusForControlCommand(
  command: 'pause' | 'resume' | 'stop' | 'redirect'
): 'paused' | 'running' | 'stopped' | null {
  if (command === 'pause') {
    return 'paused'
  }

  if (command === 'resume') {
    return 'running'
  }

  if (command === 'stop') {
    return 'stopped'
  }

  return null
}
