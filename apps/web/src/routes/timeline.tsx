import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { RealtimeImagePreview } from '../../app/components/RealtimeImagePreview'
import {
  ensureRelayPowerSyncConnected,
  watchRecentSessions,
  watchSessionActions,
} from '../../app/lib/powersync'
import { fetchLocalRelaySnapshot } from '../../app/lib/local-relay-bridge-client'
import { USE_LOCAL_RELAY_BRIDGE } from '../../app/lib/runtime-mode'
import { toScreenshotSrc } from '../../app/lib/screenshot-src'

export const Route = createFileRoute('/timeline')({ component: TimelinePage })

type SessionRow = {
  id: string
  name: string
  status: string
  original_task: string
  started_at: string
}

type ActionRow = {
  id: string
  type: string
  title: string
  detail: string | null
  screenshot_b64: string | null
  created_at: string
  sequence_number: number
}

const USE_LOCAL_BRIDGE = USE_LOCAL_RELAY_BRIDGE

function TimelinePage() {
  const [ready, setReady] = useState(USE_LOCAL_BRIDGE)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [actions, setActions] = useState<ActionRow[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  const updateActions = (nextActions: ActionRow[]) => {
    setActions(nextActions)
    setSelectedIndex((previous) => {
      if (nextActions.length === 0) {
        return 0
      }

      return Math.min(previous, nextActions.length - 1)
    })
  }

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
    if (USE_LOCAL_BRIDGE || !ready) {
      return
    }

    const stop = watchRecentSessions((rows) => {
      const mapped = rows as unknown as SessionRow[]
      setSessions(mapped)

      const selectedStillExists =
        selectedSessionId.length > 0 &&
        mapped.some((session) => session.id === selectedSessionId)

      if (!selectedStillExists) {
        setSelectedSessionId(mapped[0]?.id ?? '')
      }
    })

    return () => {
      stop()
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

        const mappedSessions = snapshot.sessions as unknown as SessionRow[]
        setSessions(mappedSessions)
        updateActions(snapshot.actions as unknown as ActionRow[])

        const selectedStillExists =
          selectedSessionId.length > 0 &&
          mappedSessions.some((session) => session.id === selectedSessionId)

        if (!selectedStillExists) {
          setSelectedSessionId(mappedSessions[0]?.id ?? '')
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
    if (USE_LOCAL_BRIDGE || !ready || !selectedSessionId) {
      return
    }

    const stop = watchSessionActions(selectedSessionId, (rows) => {
      updateActions(rows as unknown as ActionRow[])
    })

    return () => {
      stop()
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (selectedSessionId) {
      return
    }

    updateActions([])
  }, [selectedSessionId])

  useEffect(() => {
    if (!playing || actions.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setSelectedIndex((previous) => {
        if (previous >= actions.length - 1) {
          setPlaying(false)
          return actions.length - 1
        }

        return previous + 1
      })
    }, 700)

    return () => {
      window.clearInterval(timer)
    }
  }, [playing, actions.length])

  const selectedSession = useMemo(() => {
    return sessions.find((session) => session.id === selectedSessionId) ?? null
  }, [selectedSessionId, sessions])

  const currentAction = actions[selectedIndex] ?? null
  const currentScreenshot = useMemo(() => {
    if (!actions.length) {
      return null
    }

    return actions
      .slice(0, selectedIndex + 1)
      .reverse()
      .find((action) => Boolean(action.screenshot_b64))
      ?? null
  }, [actions, selectedIndex])

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm md:p-8">
        <div className="relative z-10">
          <p className="island-kicker mb-2 text-zinc-400">Relay Phase 7</p>
          <h1 className="display-title text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Session Timeline Replay
          </h1>
          <p className="m-0 mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Scrub the slider to inspect historical agent actions and replay session flow over time in a fully transparent interface.
          </p>
        </div>
      </section>

      {!ready && (
        <section className="island-shell mb-6 p-4 text-sm text-zinc-400">
          Connecting local PowerSync database...
        </section>
      )}

      {error && (
        <section className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-sm">
          {error}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="island-shell relative bg-[var(--surface-strong)] p-5 shadow-sm lg:col-span-4">
          <label className="relative z-10 mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Session Database
          </label>
          <select
            className="relative z-10 w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-sm font-mono text-zinc-200 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={selectedSessionId}
            onChange={(event) => {
              setSelectedSessionId(event.target.value)
              setSelectedIndex(0)
              setPlaying(false)
            }}
          >
            <option value="">Select a session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} [{session.status}] ({session.id.slice(0, 8)})
              </option>
            ))}
          </select>

          {selectedSession && (
            <div className="relative z-10 mt-4 rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs text-zinc-300 shadow-sm">
              <p className="m-0 mb-2 font-mono font-medium">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Task:</span>
                {selectedSession.original_task}
              </p>
              <p className="m-0 font-mono font-medium">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Started:</span>
                {new Date(selectedSession.started_at).toLocaleString()}
              </p>
            </div>
          )}
        </article>

        <article className="island-shell relative bg-[var(--surface-strong)] p-5 shadow-sm lg:col-span-8">
          <p className="island-kicker mb-3">Replay Controls</p>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md border border-[var(--line)] bg-zinc-800 px-4 py-1.5 text-xs font-medium text-zinc-200 shadow-sm transition-all hover:bg-zinc-700"
              disabled={actions.length === 0}
              onClick={() => {
                setPlaying(false)
                setSelectedIndex(0)
              }}
            >
              Reset
            </button>
            <button
              className="rounded-md border border-blue-500 bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500"
              disabled={actions.length <= 1}
              onClick={() => {
                setPlaying((previous) => !previous)
              }}
            >
              {playing ? 'Pause Replay' : 'Start Replay'}
            </button>
            <span className="rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-2.5 py-1 text-xs font-medium text-zinc-400">
              Step {actions.length === 0 ? 0 : selectedIndex + 1} of {actions.length}
            </span>
          </div>

          <div className="relative mb-2 flex h-8 w-full items-center">
            <input
              type="range"
              min={0}
              max={Math.max(actions.length - 1, 0)}
              value={selectedIndex}
              disabled={actions.length === 0}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-blue-500"
              onChange={(event) => {
                setPlaying(false)
                setSelectedIndex(Number(event.target.value))
              }}
            />
          </div>

          <div className="custom-scrollbar mt-4 h-full max-h-[min(42vh,420px)] space-y-2 overflow-auto pr-2">
            {actions.length === 0 && (
              <p className="m-0 text-sm font-mono italic text-zinc-500">No actions found for this session.</p>
            )}
            {actions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                className={`w-full rounded-md border p-3 text-left transition-all duration-150 ${
                  index === selectedIndex
                    ? 'border-blue-500/50 bg-blue-500/10 shadow-sm'
                    : 'border-[var(--line)] bg-[var(--bg-base)] hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
                onClick={() => {
                  setPlaying(false)
                  setSelectedIndex(index)
                }}
              >
                <div className="mb-1.5 flex items-start justify-between">
                  <p className={`m-0 text-sm font-bold ${index === selectedIndex ? 'text-blue-400' : 'text-zinc-200'}`}>
                    <span className="mr-1 text-zinc-500">#{action.sequence_number}</span>
                    <span className="mr-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider opacity-80">{action.type}</span>
                    {action.title}
                  </p>
                  <p className="m-0 shrink-0 text-xs font-mono text-zinc-500">
                    {new Date(action.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <p className={`m-0 max-w-full truncate text-xs font-mono ${index === selectedIndex ? 'text-blue-200/70' : 'text-zinc-400'}`}>
                  {action.detail ?? 'No detail'}
                </p>
              </button>
            ))}
          </div>
        </article>

        <article className="island-shell relative mt-2 bg-[var(--surface-strong)] p-5 shadow-sm lg:col-span-12">
          <p className="island-kicker relative z-10 mb-4">Replay Frame</p>
          {currentAction ? (
            <div className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="flex flex-col justify-center rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-5 shadow-sm lg:col-span-4">
                <p className="m-0 mb-3 flex flex-col items-start gap-2 text-sm font-bold text-zinc-100">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-300">{currentAction.type}</span>
                  <span className="leading-tight">{currentAction.title}</span>
                </p>
                <p className="m-0 mt-2 rounded-md border border-[var(--line)] bg-zinc-900 p-3 text-xs font-mono leading-relaxed text-zinc-300">
                  {currentAction.detail ?? 'No detail available for this action.'}
                </p>
                <p className="m-0 mt-4 flex items-center gap-2 text-[10px] font-mono font-medium uppercase tracking-widest text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  {new Date(currentAction.created_at).toLocaleString()}
                </p>
              </div>

              <RealtimeImagePreview
                src={currentScreenshot?.screenshot_b64 ? toScreenshotSrc(currentScreenshot.screenshot_b64) : null}
                alt="Timeline screenshot"
                emptyLabel="No screenshot captured"
                wrapperClassName="lg:col-span-8"
                imageWrapperClassName="flex min-h-[350px] items-center justify-center bg-zinc-950 p-2 shadow-sm"
                previewHeightClassName="max-h-[500px]"
                previewImageClassName="h-auto max-h-[500px] border border-[var(--line)] object-contain shadow-md"
                modalImageClassName="max-h-[84vh] w-full object-contain"
                liveLabel="Replay preview"
              />
            </div>
          ) : (
            <div className="relative z-10 flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-[var(--bg-base)] p-10 text-center">
              <span className="mb-3 text-3xl opacity-40">🎬</span>
              <p className="m-0 text-xs font-mono font-medium uppercase tracking-widest text-zinc-600">Select a session with actions to replay</p>
            </div>
          )}
        </article>
      </section>
    </main>
  )
}
