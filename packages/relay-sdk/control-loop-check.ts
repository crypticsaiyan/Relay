import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { PowerSyncDatabase, Schema, Table, column } from '@powersync/node'
import { RelaySqliteWriter } from './sqlite-writer'
import { RelayControlListener } from './control-listener'

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

async function insertCommand(
  db: PowerSyncDatabase,
  sessionId: string,
  command: 'pause' | 'resume' | 'stop' | 'redirect',
  payload: string | null = null
): Promise<string> {
  const id = randomUUID()

  await db.execute(
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
    [id, sessionId, command, payload, 'phase6-check', new Date().toISOString(), null]
  )

  return id
}

async function waitForExecuted(
  db: PowerSyncDatabase,
  commandId: string,
  timeoutMs = 5000
): Promise<void> {
  const started = Date.now()
  while (Date.now() - started <= timeoutMs) {
    const row = await db.getOptional<{ executed_at: string | null }>(
      'SELECT executed_at FROM control_commands WHERE id = ? LIMIT 1',
      [commandId]
    )

    if (row?.executed_at) {
      return
    }

    await sleep(100)
  }

  throw new Error(`Command ${commandId} did not reach executed_at within timeout`)
}

async function main(): Promise<void> {
  const workingDir = await mkdtemp(join(tmpdir(), 'relay-phase6-'))
  const sessionId = randomUUID()

  const db = new PowerSyncDatabase({
    schema: createRelaySchema(),
    database: {
      dbFilename: 'relay-control-check.db',
      dbLocation: workingDir,
      implementation: {
        type: 'node:sqlite',
      },
    },
  })

  await db.init()

  const writer = new RelaySqliteWriter(db, sessionId)
  await writer.initializeSchema()
  await writer.createSession({
    name: 'Phase 6 verification',
    agentId: 'relay-checker',
    userId: 'local-user',
    originalTask: 'Validate bidirectional control and queued replay',
    deviceName: 'Verifier',
  })

  const control = new RelayControlListener(writer, 50)
  control.start()

  const pauseId = await insertCommand(db, sessionId, 'pause')
  await waitForExecuted(db, pauseId)
  if (!control.snapshot().paused) {
    throw new Error('Expected listener to enter paused state after pause command')
  }

  const redirectPayload = 'Switch to checkout and validate taxes'
  const redirectId = await insertCommand(db, sessionId, 'redirect', redirectPayload)
  await waitForExecuted(db, redirectId)
  if (control.consumeRedirectInstruction() !== redirectPayload) {
    throw new Error('Expected redirect payload to be consumable by listener')
  }

  const resumeId = await insertCommand(db, sessionId, 'resume')
  await waitForExecuted(db, resumeId)
  await sleep(120)
  if (control.snapshot().paused) {
    throw new Error('Expected listener to leave paused state after resume command')
  }

  control.stop()
  const queuedWhileOfflineId = await insertCommand(db, sessionId, 'redirect', 'Queued while listener stopped')
  await sleep(200)

  const beforeReplay = await db.getOptional<{ executed_at: string | null }>(
    'SELECT executed_at FROM control_commands WHERE id = ? LIMIT 1',
    [queuedWhileOfflineId]
  )

  if (beforeReplay?.executed_at) {
    throw new Error('Queued command should remain pending while listener is stopped')
  }

  control.start()
  await waitForExecuted(db, queuedWhileOfflineId)

  const stopId = await insertCommand(db, sessionId, 'stop')
  await waitForExecuted(db, stopId)
  if (!control.snapshot().stopRequested) {
    throw new Error('Expected listener to set stopRequested after stop command')
  }

  control.stop()
  await db.close()
  await rm(workingDir, { recursive: true, force: true })

  console.log('Phase 6 verification passed: pause/resume/redirect/stop and queued replay behavior confirmed.')
}

void main().catch((error: unknown) => {
  console.error('Phase 6 verification failed:', error)
  process.exit(1)
})
