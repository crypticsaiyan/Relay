import { config as loadEnv } from 'dotenv'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Prefer workspace root .env for monorepo runs, then fall back to local .env.
loadEnv({ path: resolve(__dirname, '../../.env') })
loadEnv()

const RELAY_SCHEMA_FILE = resolve(__dirname, 'schema.sql')
const DEFAULT_MIGRATION_NAME = '0001_init_relay_schema'

async function readSchemaSql(): Promise<string> {
  return readFile(RELAY_SCHEMA_FILE, 'utf8')
}

function buildMigrationChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS relay_schema_migrations (
      id TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function migrationAlreadyApplied(client: Client, migrationId: string): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    'SELECT id FROM relay_schema_migrations WHERE id = $1 LIMIT 1',
    [migrationId]
  )

  return (result.rowCount ?? 0) > 0
}

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

  if (!databaseUrl) {
    console.warn('DATABASE_URL_UNPOOLED or DATABASE_URL is not set. Skipping migration run.')
    return
  }

  const schemaSql = await readSchemaSql()
  const checksum = buildMigrationChecksum(schemaSql)
  const migrationId = `${DEFAULT_MIGRATION_NAME}_${checksum.slice(0, 12)}`

  const client = new Client({ connectionString: databaseUrl })

  await client.connect()

  try {
    await client.query('BEGIN')
    await ensureMigrationsTable(client)

    const alreadyApplied = await migrationAlreadyApplied(client, migrationId)
    if (alreadyApplied) {
      await client.query('COMMIT')
      console.log(`Migration already applied: ${migrationId}`)
      return
    }

    await client.query(schemaSql)
    await client.query(
      'INSERT INTO relay_schema_migrations (id, checksum) VALUES ($1, $2)',
      [migrationId, checksum]
    )

    await client.query('COMMIT')
    console.log(`Migration applied successfully: ${migrationId}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

const isDirectRun = process.argv[1] === __filename
if (isDirectRun) {
  runMigrations().catch((error: unknown) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
}
