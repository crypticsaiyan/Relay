import { useEffect, useMemo, useState } from 'react'
import {
  ensureRelayPowerSyncConnected,
  issueControlCommand,
  setSessionShareToken,
  watchControlCommands,
  watchRecentSessions,
  watchSessionActions,
  watchSessionDriftAlerts,
  watchSessionInfo,
  watchSessionReasoning,
  watchSessionWatchers,
  type AgentReasoningRow,
  type DriftAlertRow,
  type WatcherRow,
} from '../lib/powersync'
import {
  fetchLocalRelaySnapshot,
  postLocalRelayControl,
  postLocalRelayShare,
} from '../lib/local-relay-bridge-client'
import { USE_LOCAL_RELAY_BRIDGE } from '../lib/runtime-mode'
import { ScreenThumbnail } from '../components/ScreenThumbnail'
import { buildFallbackScreenshotSrc, toScreenshotSrc } from '../lib/screenshot-src'

type SessionRow = {
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
}

type ActionRow = {
  id: string
  session_id: string
  type: string
  title: string
  detail: string | null
  screenshot_b64: string | null
  created_at: string
  sequence_number: number
}

type ControlRow = {
  id: string
  session_id: string
  command: string
  payload: string | null
  issued_by: string
  issued_at: string
  executed_at: string | null
}

type ViewState = {
  sessions: SessionRow[]
  currentSession: SessionRow | null
  actions: ActionRow[]
  reasoning: AgentReasoningRow[]
  controls: ControlRow[]
  driftAlerts: DriftAlertRow[]
  watchers: WatcherRow[]
}

const INITIAL_VIEW_STATE: ViewState = {
  sessions: [],
  currentSession: null,
  actions: [],
  reasoning: [],
  controls: [],
  driftAlerts: [],
  watchers: [],
}

const ACTION_TONE: Record<string, string> = {
  navigate: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  type: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  click: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  read: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  decide: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  wait: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  screenshot: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  redirect: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  resume: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  stop: 'bg-zinc-800 text-zinc-300 border-zinc-700',
}

const USE_LOCAL_BRIDGE = USE_LOCAL_RELAY_BRIDGE

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function isRunningStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'running'
}

function isPausedStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'paused'
}

export default function App() {
  const [ready, setReady] = useState(USE_LOCAL_BRIDGE)
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [view, setView] = useState<ViewState>(INITIAL_VIEW_STATE)
  const [redirectText, setRedirectText] = useState('')
  const [issuedBy, setIssuedBy] = useState('web-operator')
  const [error, setError] = useState<string>('')
  const [pendingControl, setPendingControl] = useState(false)
  const [status, setStatus] = useState('')
  const [clockTick, setClockTick] = useState(0)

  useEffect(() => {
    if (USE_LOCAL_BRIDGE) {
      setReady(true)
      return
    }

    let disposed = false

    const boot = async () => {
      try {
        await ensureRelayPowerSyncConnected()
        if (!disposed) {
          setReady(true)
        }
      } catch (cause) {
        if (!disposed) {
          setError(`PowerSync connection failed: ${String(cause)}`)
        }
      }
    }

    void boot()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (USE_LOCAL_BRIDGE) {
      return
    }

    if (!ready) {
      return
    }

    const unwatch = watchRecentSessions((rows) => {
      const mapped = rows as unknown as SessionRow[]
      setView((prev) => ({ ...prev, sessions: mapped }))

      const selectedStillExists =
        selectedSessionId.length > 0 &&
        mapped.some((session) => session.id === selectedSessionId)

      if (!selectedStillExists) {
        const preferredSessionId = pickPreferredSessionId(mapped)
        if (preferredSessionId !== selectedSessionId) {
          setSelectedSessionId(preferredSessionId)
        }
      }
    })

    return () => {
      unwatch()
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (USE_LOCAL_BRIDGE) {
      return
    }

    if (!ready || !selectedSessionId) {
      return
    }

    const stops = [
      watchSessionInfo(selectedSessionId, (rows) => {
        setView((prev) => ({
          ...prev,
          currentSession: (rows[0] as unknown as SessionRow | undefined) ?? null,
        }))
      }),
      watchSessionActions(selectedSessionId, (rows) => {
        setView((prev) => ({ ...prev, actions: rows as unknown as ActionRow[] }))
      }),
      watchSessionReasoning(selectedSessionId, (rows) => {
        setView((prev) => ({ ...prev, reasoning: rows }))
      }),
      watchControlCommands(selectedSessionId, (rows) => {
        setView((prev) => ({ ...prev, controls: rows as unknown as ControlRow[] }))
      }),
      watchSessionDriftAlerts(selectedSessionId, (rows) => {
        setView((prev) => ({ ...prev, driftAlerts: rows }))
      }),
      watchSessionWatchers(selectedSessionId, (rows) => {
        setView((prev) => ({ ...prev, watchers: rows }))
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop()
      }
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (!USE_LOCAL_BRIDGE || !ready) {
      return
    }

    let active = true

    const sync = async () => {
      try {
        const snapshot = await fetchLocalRelaySnapshot({
          sessionId: selectedSessionId || null,
        })

        if (!active) {
          return
        }

        setError('')
        setView(snapshot)

        const selectedStillExists =
          selectedSessionId.length > 0 &&
          snapshot.sessions.some((session) => session.id === selectedSessionId)

        if (!selectedStillExists) {
          const preferredSessionId = pickPreferredSessionId(snapshot.sessions)
          if (preferredSessionId !== selectedSessionId) {
            setSelectedSessionId(preferredSessionId)
          }
        }
      } catch (cause) {
        if (active) {
          setError(`Local relay bridge failed: ${String(cause)}`)
        }
      }
    }

    void sync()
    const timer = window.setInterval(() => {
      void sync()
    }, 1000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((prev) => prev + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const latestScreenshot = useMemo(() => {
    return view.actions
      .slice()
      .reverse()
      .find((action) => Boolean(action.screenshot_b64))
  }, [view.actions])

  const latestAction = useMemo(() => {
    return view.actions[view.actions.length - 1] ?? null
  }, [view.actions])

  const liveScreenSrc = useMemo(() => {
    if (latestScreenshot?.screenshot_b64) {
      return toScreenshotSrc(latestScreenshot.screenshot_b64)
    }

    if (!view.currentSession && !latestAction) {
      return null
    }

    return buildFallbackScreenshotSrc({
      sessionName: view.currentSession?.name ?? null,
      status: view.currentSession?.status ?? null,
      title: latestAction ? `${latestAction.type}: ${latestAction.title}` : null,
      detail: latestAction?.detail ?? null,
      reasoning: view.reasoning[0]?.thought ?? null,
    })
  }, [latestAction, latestScreenshot, view.currentSession, view.reasoning])

  const issueControl = async (command: 'pause' | 'resume' | 'stop' | 'redirect') => {
    if (!selectedSessionId || pendingControl) {
      return
    }

    if (command === 'redirect' && !redirectText.trim()) {
      setError('Redirect command needs instructions.')
      return
    }

    try {
      setPendingControl(true)
      setError('')
      setStatus('')
      if (USE_LOCAL_BRIDGE) {
        await postLocalRelayControl({
          sessionId: selectedSessionId,
          command,
          payload: command === 'redirect' ? redirectText.trim() : null,
          issuedBy: issuedBy.trim() || 'web-operator',
        })
      } else {
        await issueControlCommand({
          sessionId: selectedSessionId,
          command,
          payload: command === 'redirect' ? redirectText.trim() : null,
          issuedBy: issuedBy.trim() || 'web-operator',
        })
      }

      if (command === 'redirect') {
        setRedirectText('')
      }
    } catch (cause) {
      setError(`Command failed: ${String(cause)}`)
    } finally {
      setPendingControl(false)
    }
  }

  const copyShareLink = async () => {
    if (!selectedSessionId) {
      return
    }

    try {
      setError('')
      setStatus('')
      const token = view.currentSession?.share_token ?? `relay-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
      if (USE_LOCAL_BRIDGE) {
        await postLocalRelayShare({
          sessionId: selectedSessionId,
          shareToken: token,
        })
      } else {
        await setSessionShareToken({ sessionId: selectedSessionId, shareToken: token })
      }
      const link = `${window.location.origin}/handoff?session=${selectedSessionId}&share=${token}`
      await navigator.clipboard.writeText(link)
      setStatus('Handoff link copied.')
    } catch (cause) {
      setError(`Share failed: ${String(cause)}`)
    }
  }

  const pagesVisited = useMemo(() => {
    return new Set(
      view.actions
        .filter((action) => action.type === 'navigate')
        .map((action) => action.title)
    ).size
  }, [view.actions])

  const runningTime = useMemo(() => {
    if (!view.currentSession?.started_at) {
      return '0:00'
    }

    const diffMs = Math.max(0, Date.now() - new Date(view.currentSession.started_at).getTime())
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }, [view.currentSession, clockTick])

  const activeTaskSessions = useMemo(() => {
    const activeSessions = view.sessions.filter(
      (session) => isRunningStatus(session.status) || isPausedStatus(session.status)
    )
    const source = activeSessions.length > 0 ? activeSessions : view.sessions
    return source.slice(0, 3)
  }, [view.sessions])

  const progressItems = useMemo(() => {
    const source = view.actions.slice(-6)
    return source.map((action, index) => ({
      id: action.id,
      label: action.title,
      state: index === source.length - 1 ? 'current' : 'done',
    }))
  }, [view.actions])

  return (
    <main className="page-wrap flex h-[calc(100dvh-56px)] max-h-[calc(100dvh-56px)] min-h-0 flex-col overflow-hidden px-4 pb-2 pt-2">
      {!ready && (
        <section className="island-shell mb-4 p-4 text-sm text-[var(--sea-ink-soft)]">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            Connecting local PowerSync database...
          </div>
        </section>
      )}

      {error && (
        <section className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </section>
      )}

      {status && (
        <section className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {status}
        </section>
      )}

      <section className="island-shell flex-1 min-h-0 overflow-hidden">
        <div className="grid h-full max-h-full min-h-0 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
          <aside className="custom-scrollbar flex h-full min-h-0 max-h-full flex-col overflow-y-auto border-b border-[var(--line)] bg-[var(--surface-strong)] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-[var(--line)] p-4">
              <p className="island-kicker mb-3">Active Tasks</p>
              <div className="space-y-2">
                {activeTaskSessions.map((session) => {
                  const active = session.id === selectedSessionId
                  return (
                    <button
                      key={session.id}
                      className={`group w-full rounded-md border p-3 text-left transition-all duration-150 ${active ? 'border-[var(--line)] bg-zinc-800' : 'border-transparent bg-transparent hover:bg-zinc-800/50 hover:border-[var(--line)]'}`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <p className={`m-0 text-sm font-medium transition-colors ${active ? 'text-zinc-50' : 'text-zinc-300'}`}>{session.name}</p>
                      <p className="m-0 mt-1 text-xs text-zinc-500">{session.agent_id}</p>
                      <p className={`m-0 mt-1 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider ${isRunningStatus(session.status) ? 'text-blue-400' : isPausedStatus(session.status) ? 'text-amber-400' : 'text-zinc-500'}`}>
                        {isRunningStatus(session.status) && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        {isRunningStatus(session.status) ? 'Running' : isPausedStatus(session.status) ? 'Paused' : session.status}
                        {active ? <span className="normal-case font-medium text-zinc-500 ml-auto"> {runningTime}</span> : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="shrink-0 p-4 hidden md:block">
              <p className="island-kicker mb-3">Session Stats</p>
              <div className="space-y-2.5 text-xs text-zinc-400">
                <StatRow label="Actions taken" value={String(view.actions.length)} />
                <StatRow label="Pages visited" value={String(pagesVisited)} />
                <StatRow label="Running time" value={runningTime} />
                <StatRow label="Device" value={view.currentSession?.device_name ?? 'unknown'} />
              </div>
            </div>
          </aside>

          <section className="flex h-full min-h-0 min-w-0 max-h-full flex-col border-b border-[var(--line)] bg-[var(--bg-base)] lg:border-b-0 lg:border-r">
            <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="island-kicker mb-0 mr-2">Controls</p>
                <button className="rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all" disabled={!selectedSessionId || pendingControl} onClick={() => { void issueControl('pause') }}>Pause</button>
                <button className="rounded-md border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all" disabled={!selectedSessionId || pendingControl} onClick={() => { void issueControl('stop') }}>Stop</button>
                <button className="rounded-md border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-all" disabled={!selectedSessionId || pendingControl} onClick={() => { void issueControl('resume') }}>Resume</button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={issuedBy} onChange={(event) => setIssuedBy(event.target.value)} className="w-full sm:w-[120px] rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500" placeholder="Operator" />
                <input value={redirectText} onChange={(event) => setRedirectText(event.target.value)} className="flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500" placeholder="Redirect agent..." />
                <button className="rounded-md border border-blue-500 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition-all" disabled={!selectedSessionId || pendingControl || !redirectText.trim()} onClick={() => { void issueControl('redirect') }}>Send</button>
              </div>
            </div>

            <div className="custom-scrollbar flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4">
              {view.actions.slice().reverse().map((action) => (
                <div key={action.id} className="group rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 shadow-sm hover:border-zinc-700 transition-all">
                  <div className="flex gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[0.6rem] font-bold tracking-wider ${ACTION_TONE[action.type] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                      {action.type.slice(0, 3)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="m-0 text-sm font-semibold text-zinc-200">{action.title}</p>
                        <p className="m-0 shrink-0 text-right text-xs text-zinc-500">{formatRelativeTime(action.created_at)}</p>
                      </div>
                      <p className="m-0 mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-400 bg-zinc-950 p-2.5 rounded-md border border-[var(--line)]">
                        {action.detail ?? 'No detail'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {view.reasoning[0] && (
                <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <p className="island-kicker mb-0">Agent Reasoning</p>
                  </div>
                  <p className="m-0 text-xs leading-relaxed text-zinc-300">
                    "{view.reasoning[0].thought}"
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="custom-scrollbar flex h-full min-h-0 max-h-full flex-col overflow-y-auto bg-[var(--surface-strong)]">
            <div className="shrink-0 border-b border-[var(--line)] p-4">
              <p className="island-kicker mb-3">Task Progress</p>
              <div className="space-y-2 relative before:absolute before:inset-y-2 before:left-[11px] before:w-[1px] before:bg-zinc-800">
                {progressItems.map((item) => (
                  <div key={item.id} className="relative flex items-start gap-4 text-xs bg-[var(--bg-base)] p-3 rounded-md border border-[var(--line)]">
                    <span className={`relative z-10 mt-0.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--surface-strong)] ${item.state === 'done' ? 'bg-zinc-500' : 'bg-blue-500'}`} />
                    <span className={item.state === 'done' ? 'text-zinc-500 line-through decoration-zinc-700' : 'font-medium text-zinc-200'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-b border-[var(--line)] p-4">
              <ScreenThumbnail
                src={liveScreenSrc}
                alt="Latest agent screenshot"
                label="Waiting for screen..."
                caption={
                  extractScreenLabel(view.actions)
                  ?? view.currentSession?.name
                  ?? view.sessions[0]?.name
                  ?? 'No recent session'
                }
              />
            </div>

            <div className="shrink-0 p-4 border-b border-[var(--line)] hidden md:block">
              <p className="island-kicker mb-3">Watchers</p>
              {view.watchers.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {view.watchers.slice(0, 3).map((watcher, index) => (
                      <div key={watcher.user_id} className={`flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-xs font-bold ${index === 0 ? 'bg-blue-500/10 text-blue-400' : index === 1 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {watcher.user_id.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <p className="m-0 mt-3 text-xs text-zinc-500">
                    {view.watchers.length} people watching live
                  </p>
                </>
              ) : (
                <p className="m-0 text-xs text-zinc-500">No watchers connected.</p>
              )}
            </div>

            <div className="shrink-0 p-4 hidden md:block">
              <p className="island-kicker mb-3">Share</p>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!selectedSessionId}
                onClick={() => {
                  void copyShareLink()
                }}
              >
                Handoff link <span>↗</span>
              </button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="font-medium text-zinc-500">{label}</span>
      <span className="text-xs font-bold text-zinc-200">{value}</span>
    </div>
  )
}

function formatRelativeTime(value: string): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`
  }

  const minutes = Math.floor(diffSeconds / 60)
  return `${minutes}:${String(diffSeconds % 60).padStart(2, '0')} ago`
}

function extractScreenLabel(actions: ActionRow[]): string | null {
  const latestNavigate = actions
    .slice()
    .reverse()
    .find((action) => action.type === 'navigate')

  const detail = latestNavigate?.detail ?? ''
  const urlMatch = detail.match(/https?:\/\/[^\s]+/i)
  if (urlMatch?.[0]) {
    try {
      return new URL(urlMatch[0]).hostname
    } catch {
      return urlMatch[0]
    }
  }

  return latestNavigate?.title ?? null
}

function pickPreferredSessionId(sessions: SessionRow[]): string {
  const preferredSession =
    sessions.find((session) => isRunningStatus(session.status))
    ?? sessions.find((session) => isPausedStatus(session.status))
    ?? sessions[0]

  return preferredSession?.id ?? ''
}
