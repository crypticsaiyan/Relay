export type AgentSessionStatus = 'running' | 'paused' | 'stopped' | 'completed'

export interface AgentSession {
  id: string
  name: string
  agentId: string
  userId: string
  status: AgentSessionStatus
  originalTask: string
  startedAt: string
  completedAt: string | null
  deviceName: string
  shareToken: string | null
}

export type AgentActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'read'
  | 'decide'
  | 'wait'
  | 'screenshot'
  | 'redirect'
  | 'resume'
  | 'stop'

export interface AgentAction {
  id: string
  sessionId: string
  type: AgentActionType
  title: string
  detail: string
  screenshotB64: string | null
  createdAt: string
  sequenceNumber: number
}

export interface AgentReasoning {
  id: string
  sessionId: string
  actionId: string
  thought: string
  createdAt: string
}

export type ControlCommandType = 'pause' | 'resume' | 'stop' | 'redirect'

export interface ControlCommand {
  id: string
  sessionId: string
  command: ControlCommandType
  payload: string | null
  issuedBy: string
  issuedAt: string
  executedAt: string | null
}

export interface DriftAlert {
  id: string
  sessionId: string
  originalTask: string
  currentAction: string
  driftScore: number
  explanation: string
  createdAt: string
}

export type WatcherDeviceType = 'mobile' | 'desktop' | 'tablet'

export interface Watcher {
  sessionId: string
  userId: string
  deviceType: WatcherDeviceType
  joinedAt: string
  lastSeenAt: string
}
