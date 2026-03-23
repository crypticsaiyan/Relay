import { createServerFn } from '@tanstack/react-start'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

type CrudEntryInput = {
  op_id: number
  op: 'PUT' | 'PATCH' | 'DELETE'
  type: string
  id: string
  tx_id?: number
  data?: Record<string, unknown>
  old?: Record<string, unknown>
  metadata?: string
}

type UploadEnvelope = {
  batch: CrudEntryInput[]
}

type SourceStats = {
  agent_sessions: number
}

type WatcherHeartbeatInput = {
  sessionId: string
  userId: string
  deviceType: 'mobile' | 'desktop' | 'tablet'
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envFilePath = resolve(__dirname, '../../../../.env')
let fallbackEnv: Map<string, string> | null = null

function loadFallbackEnv(): Map<string, string> {
  if (fallbackEnv) {
    return fallbackEnv
  }

  const entries = new Map<string, string>()
  if (!existsSync(envFilePath)) {
    fallbackEnv = entries
    return entries
  }

  const lines = readFileSync(envFilePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const unquoted =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue.startsWith("'") && rawValue.endsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue

    entries.set(key, unquoted)
  }

  fallbackEnv = entries
  return entries
}

function readServerEnv(name: string): string | null {
  const direct = process.env[name]
  if (direct && direct.trim().length > 0) {
    return direct
  }

  return loadFallbackEnv().get(name) ?? null
}

const TABLE_COLUMNS = {
  agent_sessions: [
    'id',
    'name',
    'agent_id',
    'user_id',
    'status',
    'original_task',
    'started_at',
    'completed_at',
    'device_name',
    'share_token',
  ],
  agent_actions: [
    'id',
    'session_id',
    'type',
    'title',
    'detail',
    'screenshot_b64',
    'created_at',
    'sequence_number',
  ],
  agent_reasoning: [
    'id',
    'session_id',
    'action_id',
    'thought',
    'created_at',
  ],
  control_commands: [
    'id',
    'session_id',
    'command',
    'payload',
    'issued_by',
    'issued_at',
    'executed_at',
  ],
  drift_alerts: [
    'id',
    'session_id',
    'original_task',
    'current_action',
    'drift_score',
    'explanation',
    'created_at',
  ],
} as const

type UploadableTable = keyof typeof TABLE_COLUMNS

function isUploadableTable(value: string): value is UploadableTable {
  return value in TABLE_COLUMNS
}

function getDatabaseUrl(): string {
  const value = readServerEnv('DATABASE_URL_UNPOOLED') ?? readServerEnv('DATABASE_URL')
  if (!value) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required for PowerSync uploads')
  }

  return value
}

function normalizeRowData(entry: CrudEntryInput): Record<string, unknown> {
  return {
    ...(entry.data ?? {}),
    id: entry.id,
  }
}

function pickKnownColumns(
  table: UploadableTable,
  source: Record<string, unknown>
): Array<[string, unknown]> {
  return TABLE_COLUMNS[table]
    .filter((column) => Object.prototype.hasOwnProperty.call(source, column))
    .map((column) => [column, source[column] ?? null])
}

async function applyPut(
  client: Client,
  table: UploadableTable,
  entry: CrudEntryInput
): Promise<void> {
  const rowData = normalizeRowData(entry)
  const columns = pickKnownColumns(table, rowData)
  if (columns.length === 0) {
    throw new Error(`Cannot upload ${table} PUT with no writable columns`)
  }

  const names = columns.map(([name]) => name)
  const values = columns.map(([, value]) => value)
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')
  const updateAssignments = names
    .filter((name) => name !== 'id')
    .map((name) => `${name} = EXCLUDED.${name}`)
    .join(', ')

  const sql = updateAssignments.length > 0
    ? `
        INSERT INTO ${table} (${names.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${updateAssignments}
      `
    : `
        INSERT INTO ${table} (${names.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING
      `

  await client.query(sql, values)
}

async function applyPatch(
  client: Client,
  table: UploadableTable,
  entry: CrudEntryInput
): Promise<void> {
  const rowData = entry.data ?? {}
  const columns = pickKnownColumns(table, rowData).filter(([name]) => name !== 'id')
  if (columns.length === 0) {
    return
  }

  const assignments = columns.map(([name], index) => `${name} = $${index + 1}`).join(', ')
  const values = columns.map(([, value]) => value)
  values.push(entry.id)

  await client.query(
    `
      UPDATE ${table}
      SET ${assignments}
      WHERE id = $${values.length}
    `,
    values
  )
}

async function applyDelete(
  client: Client,
  table: UploadableTable,
  entry: CrudEntryInput
): Promise<void> {
  await client.query(`DELETE FROM ${table} WHERE id = $1`, [entry.id])
}

async function applyCrudEntry(client: Client, entry: CrudEntryInput): Promise<void> {
  if (!isUploadableTable(entry.type)) {
    throw new Error(`Unsupported PowerSync upload table: ${entry.type}`)
  }

  if (entry.op === 'PUT') {
    await applyPut(client, entry.type, entry)
    return
  }

  if (entry.op === 'PATCH') {
    await applyPatch(client, entry.type, entry)
    return
  }

  if (entry.op === 'DELETE') {
    await applyDelete(client, entry.type, entry)
    return
  }

  throw new Error(`Unsupported PowerSync upload op: ${entry.op}`)
}

export const uploadPowerSyncCrudBatch = createServerFn({ method: 'POST' })
  .inputValidator((input: UploadEnvelope) => input)
  .handler(async ({ data }) => {
    const client = new Client({ connectionString: getDatabaseUrl() })
    await client.connect()

    try {
      await client.query('BEGIN')

      for (const entry of data.batch) {
        await applyCrudEntry(client, entry)
      }

      await client.query('COMMIT')
      return { ok: true }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      await client.end()
    }
  })

export const getRelaySourceStats = createServerFn({ method: 'GET' })
  .handler(async (): Promise<SourceStats> => {
    const client = new Client({ connectionString: getDatabaseUrl() })
    await client.connect()

    try {
      const result = await client.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM agent_sessions'
      )

      return {
        agent_sessions: result.rows[0]?.count ?? 0,
      }
    } finally {
      await client.end()
    }
  })

export const upsertRemoteWatcher = createServerFn({ method: 'POST' })
  .inputValidator((input: WatcherHeartbeatInput) => input)
  .handler(async ({ data }) => {
    const client = new Client({ connectionString: getDatabaseUrl() })
    await client.connect()

    const now = new Date().toISOString()

    try {
      await client.query(
        `
          INSERT INTO watchers (
            session_id,
            user_id,
            device_type,
            joined_at,
            last_seen_at
          ) VALUES (
            $1,
            $2,
            $3,
            COALESCE(
              (
                SELECT joined_at
                FROM watchers
                WHERE session_id = $1 AND user_id = $2
                LIMIT 1
              ),
              $4
            ),
            $4
          )
          ON CONFLICT (session_id, user_id) DO UPDATE SET
            device_type = EXCLUDED.device_type,
            last_seen_at = EXCLUDED.last_seen_at
        `,
        [data.sessionId, data.userId, data.deviceType, now]
      )

      return { ok: true }
    } finally {
      await client.end()
    }
  })
