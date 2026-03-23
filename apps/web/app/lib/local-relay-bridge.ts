import { createServerFn } from '@tanstack/react-start'
import {
  issueLocalRelayControlRecord,
  readLocalRelaySnapshot,
  setLocalRelayShareToken,
  upsertLocalWatcherRecord,
  type LocalRelaySnapshot,
} from './local-relay-store.server'

export type { LocalRelaySnapshot }

export const getLocalRelaySnapshot = createServerFn({ method: 'GET' })
  .inputValidator((input: { sessionId?: string | null }) => input)
  .handler(async ({ data }): Promise<LocalRelaySnapshot> => {
    return readLocalRelaySnapshot(data)
  })

export const upsertLocalWatcher = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    sessionId: string
    userId: string
    deviceType: 'mobile' | 'desktop' | 'tablet'
  }) => input)
  .handler(async ({ data }) => {
    return upsertLocalWatcherRecord(data)
  })

export const issueLocalRelayControl = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    sessionId: string
    command: 'pause' | 'resume' | 'stop' | 'redirect'
    payload?: string | null
    issuedBy: string
  }) => input)
  .handler(async ({ data }) => {
    return issueLocalRelayControlRecord(data)
  })

export const setLocalRelayShare = createServerFn({ method: 'POST' })
  .inputValidator((input: { sessionId: string; shareToken: string | null }) => input)
  .handler(async ({ data }) => {
    return setLocalRelayShareToken(data)
  })
