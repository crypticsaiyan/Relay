import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations } from './migrate'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const relayDbAssets = {
  neonSchemaSqlPath: resolve(__dirname, 'schema.sql'),
  powersyncSchemaSqlPath: resolve(__dirname, 'powersync-schema.sql'),
  powersyncRulesPath: resolve(__dirname, 'powersync.yaml'),
} as const

export { runMigrations }
