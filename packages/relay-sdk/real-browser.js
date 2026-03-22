#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const args = process.argv.slice(2)
const hasTask = args.includes('--task')
const hasUrl = args.includes('--screenshot-url')

const child = spawn(
  process.execPath,
  [
    '--import',
    'tsx',
    resolve(__dirname, 'index.ts'),
    ...(hasTask ? [] : ['--task', 'Observe the live website, interact safely, and keep the human informed in real time']),
    ...(hasUrl ? [] : ['--screenshot-url', 'https://example.com']),
    ...args,
  ],
  {
    stdio: 'inherit',
    env: process.env,
  }
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
