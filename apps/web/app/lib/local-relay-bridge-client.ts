export type LocalRelaySessionRow = {
  id: string
  name: string
  agent_id: string
  user_id: string
  status: string
  original_task: string
  started_at: string
  completed_at: string | null
  device_name: string | null
  share_token: string | null
  last_activity_at?: string | null
}

export type LocalRelayActionRow = {
  id: string
  session_id: string
  type: string
  title: string
  detail: string | null
  screenshot_b64: string | null
  created_at: string
  sequence_number: number
}

export type LocalRelayReasoningRow = {
  id: string
  session_id: string
  action_id: string
  thought: string
  created_at: string
}

export type LocalRelayControlRow = {
  id: string
  session_id: string
  command: string
  payload: string | null
  issued_by: string
  issued_at: string
  executed_at: string | null
}

export type LocalRelayDriftAlertRow = {
  id: string
  session_id: string
  original_task: string
  current_action: string
  drift_score: number
  explanation: string
  created_at: string
}

export type LocalRelayWatcherRow = {
  session_id: string
  user_id: string
  device_type: string
  joined_at: string
  last_seen_at: string
}

export type LocalRelaySnapshot = {
  sessions: LocalRelaySessionRow[]
  currentSession: LocalRelaySessionRow | null
  actions: LocalRelayActionRow[]
  reasoning: LocalRelayReasoningRow[]
  controls: LocalRelayControlRow[]
  driftAlerts: LocalRelayDriftAlertRow[]
  watchers: LocalRelayWatcherRow[]
}

export type LocalRelayControlInput = {
  sessionId: string
  command: 'pause' | 'resume' | 'stop' | 'redirect'
  payload?: string | null
  issuedBy: string
}

export async function fetchLocalRelaySnapshot(input?: {
  sessionId?: string | null
}): Promise<LocalRelaySnapshot> {
  const url = new URL('/api/local-relay-snapshot', window.location.origin)

  if (input?.sessionId) {
    url.searchParams.set('sessionId', input.sessionId)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Local relay snapshot failed with ${response.status}`)
  }

  return response.json() as Promise<LocalRelaySnapshot>
}

export async function postLocalRelayControl(input: LocalRelayControlInput): Promise<{
  ok: boolean
  skipped?: string
}> {
  const response = await fetch('/api/local-relay-control', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Local relay control failed with ${response.status}`)
  }

  return response.json() as Promise<{ ok: boolean; skipped?: string }>
}

export async function postLocalRelayShare(input: {
  sessionId: string
  shareToken: string | null
}): Promise<{
  ok: boolean
  skipped?: string
}> {
  const response = await fetch('/api/local-relay-share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Local relay share failed with ${response.status}`)
  }

  return response.json() as Promise<{ ok: boolean; skipped?: string }>
}
