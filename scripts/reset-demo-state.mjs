import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

const relaySdkDir = resolve(repoRoot, 'packages/relay-sdk')
const relayDataEntries = readdirSync(relaySdkDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('.relay-data'))
  .map((entry) => resolve(relaySdkDir, entry.name))

const rootRelayDataDir = resolve(repoRoot, '.relay-data')
const targets = [
  ...(existsSync(rootRelayDataDir) ? [rootRelayDataDir] : []),
  ...relayDataEntries,
]

if (targets.length === 0) {
  console.log('No Relay demo data directories found.')
} else {
  for (const target of targets) {
    rmSync(target, { recursive: true, force: true })
    console.log(`Removed ${target}`)
  }
}

const freshRelayDataDir = resolve(relaySdkDir, '.relay-data')
mkdirSync(freshRelayDataDir, { recursive: true })
console.log(`Created fresh demo data directory at ${freshRelayDataDir}`)
