import type { AgentActionType, AgentSessionStatus } from '@relay/shared'

export type RelayBridgeActionInput = {
  type: AgentActionType
  title: string
  detail?: string
  screenshotB64?: string | null
  reasoning?: string
}

export type RelayBridgeDriftInput = {
  originalTask: string
  currentAction: string
  driftScore: number
  explanation: string
}

export type RelayBridgeControlState = {
  paused: boolean
  stopRequested: boolean
  redirectInstruction: string | null
}

export type RelayBridgeHealthResponse = {
  ok: boolean
  mode: 'bridge'
  sessionId: string
}

export type RelayBridgeActionResponse = {
  ok: boolean
  actionId: string
}

type RelayBridgeClientOptions = {
  baseUrl?: string
  fetch?: typeof fetch
}

type RelayBridgeControlOptions = {
  consumeRedirect?: boolean
}

type RelayBridgeWaitOptions = {
  pollMs?: number
  signal?: AbortSignal
}

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:8787'

export class RelayBridgeClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(options: RelayBridgeClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BRIDGE_URL)
    this.fetchImpl = options.fetch ?? fetch
  }

  async health(): Promise<RelayBridgeHealthResponse> {
    return this.request('/health')
  }

  async action(input: RelayBridgeActionInput): Promise<RelayBridgeActionResponse> {
    return this.request('/action', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async status(status: AgentSessionStatus): Promise<{ ok: true }> {
    return this.request('/session/status', {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
  }

  async drift(input: RelayBridgeDriftInput): Promise<{ ok: true }> {
    return this.request('/drift', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async control(options: RelayBridgeControlOptions = {}): Promise<RelayBridgeControlState> {
    const query = options.consumeRedirect ? '?consumeRedirect=true' : ''
    return this.request(`/control${query}`)
  }

  async waitWhilePaused(
    options: RelayBridgeWaitOptions = {}
  ): Promise<RelayBridgeControlState> {
    const pollMs = Math.max(100, options.pollMs ?? 1000)

    while (true) {
      options.signal?.throwIfAborted()
      const control = await this.control({ consumeRedirect: true })
      if (!control.paused || control.stopRequested) {
        return control
      }
      await sleep(pollMs, options.signal)
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    const raw = await response.text()
    const payload = raw ? (JSON.parse(raw) as unknown) : null

    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : `Relay bridge request failed with ${response.status}`

      throw new Error(message)
    }

    return payload as T
  }
}

export function createRelayBridgeClient(
  options: RelayBridgeClientOptions = {}
): RelayBridgeClient {
  return new RelayBridgeClient(options)
}

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, '')
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    signal.throwIfAborted()
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const abortSignal = signal
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort)
      resolvePromise()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      abortSignal?.removeEventListener('abort', onAbort)
      rejectPromise(abortSignal?.reason ?? new Error('Relay bridge wait aborted'))
    }

    abortSignal?.addEventListener('abort', onAbort, { once: true })
  })
}
