import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const relaySdkDir = resolve(__dirname, '..')
const repoRoot = resolve(relaySdkDir, '..', '..')

loadEnv({ path: resolve(repoRoot, '.env') })
loadEnv()

const relayDataEntries = readdirSync(relaySdkDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('.relay-data'))
  .map((entry) => resolve(relaySdkDir, entry.name))

const rootRelayDataDir = resolve(repoRoot, '.relay-data')
const targets = [
  ...(existsSync(rootRelayDataDir) ? [rootRelayDataDir] : []),
  ...relayDataEntries,
]

for (const target of targets) {
  rmSync(target, { recursive: true, force: true })
  console.log(`Removed ${target}`)
}

const freshRelayDataDir = resolve(relaySdkDir, '.relay-data')
mkdirSync(freshRelayDataDir, { recursive: true })
console.log(`Created fresh demo data directory at ${freshRelayDataDir}`)

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!databaseUrl) {
  console.log('No source database configured. Local Relay state is clean.')
  process.exit(0)
}

const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  await client.query('BEGIN')
  await client.query('DELETE FROM watchers')
  await client.query('DELETE FROM drift_alerts')
  await client.query('DELETE FROM control_commands')
  await client.query('DELETE FROM agent_reasoning')
  await client.query('DELETE FROM agent_actions')
  await client.query('DELETE FROM agent_sessions')
  await client.query('COMMIT')
  console.log('Cleared source database tables for Relay demo state.')
  console.log('Reload the browser once if a PowerSync-backed tab was already open.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}
