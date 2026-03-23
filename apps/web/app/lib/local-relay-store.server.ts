import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type SessionRow = {
  id: string
  name: string
  agent_id: string
  user_id: string
  status: string
  original_task: string
  started_at: string
  completed_at: string | null
  device_name: string | null
  share_token: string | null
  last_activity_at?: string | null
}

export type ActionRow = {
  id: string
  session_id: string
  type: string
  title: string
  detail: string | null
  screenshot_b64: string | null
  created_at: string
  sequence_number: number
}

export type ReasoningRow = {
  id: string
  session_id: string
  action_id: string
  thought: string
  created_at: string
}

export type ControlRow = {
  id: string
  session_id: string
  command: string
  payload: string | null
  issued_by: string
  issued_at: string
  executed_at: string | null
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
  id?: string
  session_id: string
  user_id: string
  device_type: string
  joined_at: string
  last_seen_at: string
}

export type LocalRelaySnapshot = {
  sessions: SessionRow[]
  currentSession: SessionRow | null
  actions: ActionRow[]
  reasoning: ReasoningRow[]
  controls: ControlRow[]
  driftAlerts: DriftAlertRow[]
  watchers: WatcherRow[]
}

type LocalRelayDb = DatabaseSync

export function createEmptySnapshot(): LocalRelaySnapshot {
  return {
    sessions: [],
    currentSession: null,
    actions: [],
    reasoning: [],
    controls: [],
    driftAlerts: [],
    watchers: [],
  }
}

function runGet<T>(db: LocalRelayDb, sql: string, ...params: unknown[]): T | null {
  return (db.prepare(sql).get(...(params as any[])) as T | undefined) ?? null
}

function runAll<T>(db: LocalRelayDb, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as any[])) as T[]
}

function toPlainRow<T>(row: T | null | undefined): T | null {
  if (!row) {
    return null
  }

  return { ...row }
}

function toPlainRows<T>(rows: T[]): T[] {
  return rows.map((row) => ({ ...row }))
}

function writeJsonRow(
  db: LocalRelayDb,
  tableName: 'ps_data__control_commands' | 'ps_data__watchers',
  id: string,
  payload: Record<string, string | null>
): void {
  db.prepare(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (?, json(?))`).run(
    id,
    JSON.stringify(payload)
  )
}

function patchSessionJson(
  db: LocalRelayDb,
  sessionId: string,
  changes: Record<string, string | null>
): void {
  const existing = runGet<{ data: string }>(
    db,
    'SELECT data FROM ps_data__agent_sessions WHERE id = ? LIMIT 1',
    sessionId
  )

  if (!existing?.data) {
    return
  }

  const next = JSON.parse(existing.data) as Record<string, unknown>
  for (const [key, value] of Object.entries(changes)) {
    next[key] = value
  }

  db.prepare('UPDATE ps_data__agent_sessions SET data = json(?) WHERE id = ?').run(
    JSON.stringify(next),
    sessionId
  )
}

function resolveRelayDbPath(): string | null {
  const configured = process.env.RELAY_DATA_DIR?.trim()
  const cwd = process.cwd()
  const configuredCandidates = configured
    ? [
        resolve(cwd, configured),
        resolve(cwd, '..', configured),
        resolve(cwd, '..', '..', configured),
      ].map((candidate) =>
        candidate.endsWith('.db') ? candidate : resolve(candidate, 'relay.db')
      )
    : []

  const candidates = [
    ...configuredCandidates,
    resolve(cwd, '.relay-data/relay.db'),
    resolve(cwd, '../.relay-data/relay.db'),
    resolve(cwd, '../../.relay-data/relay.db'),
    resolve(cwd, 'packages/relay-sdk/.relay-data/relay.db'),
    resolve(cwd, '../packages/relay-sdk/.relay-data/relay.db'),
    resolve(cwd, '../../packages/relay-sdk/.relay-data/relay.db'),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function openRelayDb(): LocalRelayDb | null {
  const relayDbPath = resolveRelayDbPath()
  if (!relayDbPath || !existsSync(relayDbPath)) {
    return null
  }

  try {
    return new DatabaseSync(relayDbPath, {
      open: true,
      readOnly: false,
    })
  } catch {
    return null
  }
}

function hasRelaySchema(db: LocalRelayDb): boolean {
  try {
    const row = runGet<{ name: string }>(
      db,
      `
        SELECT name
        FROM sqlite_master
        WHERE name = 'agent_sessions'
          AND type IN ('table', 'view')
        LIMIT 1
      `
    )

    return Boolean(row?.name)
  } catch {
    return false
  }
}

export function getLocalRelayStoreDebug(): {
  cwd: string
  relayDataDir: string | null
  relayDbPath: string | null
  hasRelayDb: boolean
  hasSchema: boolean
} {
  const relayDbPath = resolveRelayDbPath()
  const db = openRelayDb()

  try {
    return {
      cwd: process.cwd(),
      relayDataDir: process.env.RELAY_DATA_DIR ?? null,
      relayDbPath,
      hasRelayDb: Boolean(db),
      hasSchema: db ? hasRelaySchema(db) : false,
    }
  } finally {
    db?.close()
  }
}

export async function readLocalRelaySnapshot(data: {
  sessionId?: string | null
}): Promise<LocalRelaySnapshot> {
  const db = openRelayDb()
  if (!db) {
    return createEmptySnapshot()
  }

  try {
    if (!hasRelaySchema(db)) {
      return createEmptySnapshot()
    }

    const sessions = toPlainRows(
      runAll<SessionRow>(
        db,
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
          LIMIT 20
        `
      )
    )

    const requestedSessionId = data.sessionId ?? null
    const selectedSessionExists =
      requestedSessionId !== null &&
      sessions.some((session) => session.id === requestedSessionId)
    const sessionId = selectedSessionExists
      ? requestedSessionId
      : (sessions[0]?.id ?? null)

    if (!sessionId) {
      return {
        sessions,
        currentSession: null,
        actions: [],
        reasoning: [],
        controls: [],
        driftAlerts: [],
        watchers: [],
      }
    }

    return {
      sessions,
      currentSession: toPlainRow(
        runGet<SessionRow>(db, 'SELECT * FROM agent_sessions WHERE id = ? LIMIT 1', sessionId)
      ),
      actions: toPlainRows(
        runAll<ActionRow>(
          db,
          'SELECT * FROM agent_actions WHERE session_id = ? ORDER BY sequence_number ASC',
          sessionId
        )
      ),
      reasoning: toPlainRows(
        runAll<ReasoningRow>(
          db,
          'SELECT * FROM agent_reasoning WHERE session_id = ? ORDER BY created_at DESC LIMIT 200',
          sessionId
        )
      ),
      controls: toPlainRows(
        runAll<ControlRow>(
          db,
          'SELECT * FROM control_commands WHERE session_id = ? ORDER BY issued_at DESC',
          sessionId
        )
      ),
      driftAlerts: toPlainRows(
        runAll<DriftAlertRow>(
          db,
          'SELECT * FROM drift_alerts WHERE session_id = ? ORDER BY created_at DESC LIMIT 50',
          sessionId
        )
      ),
      watchers: toPlainRows(
        runAll<WatcherRow>(
          db,
          'SELECT * FROM watchers WHERE session_id = ? ORDER BY last_seen_at DESC',
          sessionId
        )
      ),
    }
  } finally {
    db.close()
  }
}

export async function upsertLocalWatcherRecord(data: {
  sessionId: string
  userId: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
}): Promise<{ ok: boolean; skipped?: string }> {
  const db = openRelayDb()
  if (!db) {
    throw new Error('Local relay database not found')
  }

  try {
    if (!hasRelaySchema(db)) {
      return { ok: false, skipped: 'schema-not-ready' }
    }

    const existing = runGet<{ id: string | null; joined_at: string | null }>(
      db,
      'SELECT id, joined_at FROM watchers WHERE session_id = ? AND user_id = ? LIMIT 1',
      data.sessionId,
      data.userId
    )

    const now = new Date().toISOString()
    const watcherId = existing?.id ?? crypto.randomUUID()
    const joinedAt = existing?.joined_at ?? now

    writeJsonRow(db, 'ps_data__watchers', watcherId, {
      session_id: data.sessionId,
      user_id: data.userId,
      device_type: data.deviceType,
      joined_at: joinedAt,
      last_seen_at: now,
    })

    return { ok: true }
  } finally {
    db.close()
  }
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

export async function issueLocalRelayControlRecord(data: {
  sessionId: string
  command: 'pause' | 'resume' | 'stop' | 'redirect'
  payload?: string | null
  issuedBy: string
}): Promise<{ ok: boolean; skipped?: string }> {
  const db = openRelayDb()
  if (!db) {
    throw new Error('Local relay database not found')
  }

  try {
    if (!hasRelaySchema(db)) {
      return { ok: false, skipped: 'schema-not-ready' }
    }

    const issuedAt = new Date().toISOString()

    writeJsonRow(db, 'ps_data__control_commands', crypto.randomUUID(), {
      session_id: data.sessionId,
      command: data.command,
      payload: data.payload ?? null,
      issued_by: data.issuedBy,
      issued_at: issuedAt,
      executed_at: null,
    })

    const optimisticStatus = getOptimisticStatusForControlCommand(data.command)
    if (optimisticStatus) {
      patchSessionJson(db, data.sessionId, { status: optimisticStatus })
    }

    return { ok: true }
  } finally {
    db.close()
  }
}

export async function setLocalRelayShareToken(data: {
  sessionId: string
  shareToken: string | null
}): Promise<{ ok: boolean; skipped?: string }> {
  const db = openRelayDb()
  if (!db) {
    throw new Error('Local relay database not found')
  }

  try {
    if (!hasRelaySchema(db)) {
      return { ok: false, skipped: 'schema-not-ready' }
    }

    patchSessionJson(db, data.sessionId, { share_token: data.shareToken })

    return { ok: true }
  } finally {
    db.close()
  }
}
