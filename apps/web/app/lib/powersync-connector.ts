import type { CrudEntry, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/common'
import type { AbstractPowerSyncDatabase } from '@powersync/common'
import { uploadPowerSyncCrudBatch } from './powersync-server'

const ALLOWED_MUTATIONS = {
  control_commands: new Set(['PUT']),
  agent_sessions: new Set(['PUT', 'PATCH']),
  agent_actions: new Set(['PUT']),
  agent_reasoning: new Set(['PUT']),
  drift_alerts: new Set(['PUT']),
} as const

type AllowedMutationTable = keyof typeof ALLOWED_MUTATIONS

type UploadEnvelope = {
  batch: ReturnType<CrudEntry['toJSON']>[]
}

function assertAllowedMutation(entry: CrudEntry): void {
  const tableName = entry.table as AllowedMutationTable
  const allowedOps = ALLOWED_MUTATIONS[tableName]

  if (!allowedOps) {
    throw new Error(`Rejected mutation for unsupported table: ${entry.table}`)
  }

  if (!allowedOps.has(entry.op)) {
    throw new Error(`Rejected ${entry.op} mutation for table: ${entry.table}`)
  }

  if (tableName === 'agent_sessions' && entry.opData?.type !== 'UPDATE') {
    throw new Error('Rejected agent_sessions write because only status updates are allowed')
  }
}

async function fetchPowerSyncCredentials(): Promise<PowerSyncCredentials | null> {
  const devToken = import.meta.env.VITE_POWERSYNC_DEV_TOKEN as string | undefined
  const devEndpoint = import.meta.env.VITE_POWERSYNC_URL as string | undefined

  if (devToken && devEndpoint) {
    return {
      endpoint: devEndpoint,
      token: devToken,
    }
  }

  // PowerSync integration point: the browser always requests a fresh JWT from backend.
  const response = await fetch('/api/powersync/token', {
    method: 'GET',
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch PowerSync credentials: ${response.status}`)
  }

  const json = (await response.json()) as {
    endpoint: string
    token: string
    expiresAt?: string
  }

  return {
    endpoint: json.endpoint,
    token: json.token,
    expiresAt: json.expiresAt ? new Date(json.expiresAt) : undefined,
  }
}

async function uploadBatch(database: AbstractPowerSyncDatabase): Promise<void> {
  // PowerSync integration point: mutations are read from local SQLite and uploaded in-order.
  while (true) {
    const batch = await database.getCrudBatch(100)
    if (!batch) {
      return
    }

    for (const entry of batch.crud) {
      assertAllowedMutation(entry)
    }

    const payload: UploadEnvelope = {
      batch: batch.crud.map((entry) => entry.toJSON()),
    }
    await uploadPowerSyncCrudBatch({
      data: payload,
    })

    await batch.complete()
  }
}

export function createRelayPowerSyncConnector(): PowerSyncBackendConnector {
  return {
    fetchCredentials: fetchPowerSyncCredentials,
    uploadData: uploadBatch,
  }
}
