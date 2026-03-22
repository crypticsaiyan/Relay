#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const child = spawn(
  process.execPath,
  ['--import', 'tsx', resolve(__dirname, 'index.ts'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env,
  }
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
