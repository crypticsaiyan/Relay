import { useEffect, useMemo, useState } from 'react'
import {
  ensureRelayPowerSyncConnected,
  watchRecentSessions,
  watchSessionActions,
} from '../lib/powersync'
import { toScreenshotSrc } from '../lib/screenshot-src'

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

export default function TimelinePage() {
  const [ready, setReady] = useState(false)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [actions, setActions] = useState<ActionRow[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
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
    if (!ready) {
      return
    }

    const stop = watchRecentSessions((rows) => {
      const mapped = rows as unknown as SessionRow[]
      setSessions(mapped)

      if (!selectedSessionId && mapped[0]?.id) {
        setSelectedSessionId(mapped[0].id)
      }
    })

    return () => {
      stop()
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (!ready || !selectedSessionId) {
      return
    }

    const stop = watchSessionActions(selectedSessionId, (rows) => {
      const mapped = rows as unknown as ActionRow[]
      setActions(mapped)
      setSelectedIndex((prev) => {
        if (mapped.length === 0) {
          return 0
        }

        return Math.min(prev, mapped.length - 1)
      })
    })

    return () => {
      stop()
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (!playing || actions.length <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setSelectedIndex((prev) => {
        if (prev >= actions.length - 1) {
          setPlaying(false)
          return actions.length - 1
        }

        return prev + 1
      })
    }, 700)

    return () => {
      window.clearInterval(timer)
    }
  }, [playing, actions.length])

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
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 md:p-8 shadow-sm">
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
        <article className="island-shell p-5 lg:col-span-4 bg-[var(--surface-strong)] relative shadow-sm">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 relative z-10">
            Session Database
          </label>
          <select
            className="relative z-10 w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
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

          {sessions.find((session) => session.id === selectedSessionId) && (
            <div className="relative z-10 mt-4 rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs text-zinc-300 shadow-sm">
              <p className="m-0 font-medium font-mono mb-2">
                <span className="text-zinc-500 mr-2 uppercase text-[10px] tracking-wider font-bold">Task:</span>
                {sessions.find((session) => session.id === selectedSessionId)?.original_task}
              </p>
              <p className="m-0 font-medium font-mono">
                <span className="text-zinc-500 mr-2 uppercase text-[10px] tracking-wider font-bold">Started:</span>
                {new Date(sessions.find((session) => session.id === selectedSessionId)?.started_at ?? '').toLocaleString()}
              </p>
            </div>
          )}
        </article>

        <article className="island-shell p-5 lg:col-span-8 bg-[var(--surface-strong)] relative shadow-sm">
          <p className="island-kicker mb-3">Replay Controls</p>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-4 py-1.5 text-xs font-medium shadow-sm transition-all text-zinc-200"
              disabled={actions.length === 0}
              onClick={() => {
                setPlaying(false)
                setSelectedIndex(0)
              }}
            >
              Reset
            </button>
            <button
              className="rounded-md border border-blue-500 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold shadow-sm transition-all text-white"
              disabled={actions.length <= 1}
              onClick={() => {
                setPlaying((prev) => !prev)
              }}
            >
              {playing ? 'Pause Replay' : 'Start Replay'}
            </button>
            <span className="text-xs font-medium text-zinc-400 bg-[var(--bg-base)] px-2.5 py-1 rounded-md border border-[var(--line)] font-mono">
              Step {actions.length === 0 ? 0 : selectedIndex + 1} of {actions.length}
            </span>
          </div>

          <div className="relative w-full h-8 flex items-center mb-2">
            <input
              type="range"
              min={0}
              max={Math.max(actions.length - 1, 0)}
              value={selectedIndex}
              disabled={actions.length === 0}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              onChange={(event) => {
                setPlaying(false)
                setSelectedIndex(Number(event.target.value))
              }}
            />
          </div>

          <div className="mt-4 max-h-[300px] h-full space-y-2 overflow-auto pr-2 custom-scrollbar">
            {actions.length === 0 && (
              <p className="m-0 text-sm italic text-zinc-500 font-mono">No actions found for this session.</p>
            )}
            {actions.map((action, index) => (
              <button
                key={action.id}
                type="button"
                className={`w-full rounded-md border p-3 text-left transition-all duration-150 ${
                  index === selectedIndex
                    ? 'border-blue-500/50 bg-blue-500/10 shadow-sm'
                    : 'border-[var(--line)] bg-[var(--bg-base)] hover:bg-zinc-800/50 hover:border-zinc-700'
                }`}
                onClick={() => {
                  setPlaying(false)
                  setSelectedIndex(index)
                }}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <p className={`m-0 text-sm font-bold ${index === selectedIndex ? 'text-blue-400' : 'text-zinc-200'}`}>
                    <span className="text-zinc-500 mr-1">#{action.sequence_number}</span>
                    <span className="uppercase tracking-wider text-[10px] opacity-80 mr-1.5 bg-zinc-800 px-1.5 py-0.5 rounded">{action.type}</span> 
                    {action.title}
                  </p>
                  <p className="m-0 text-xs font-mono text-zinc-500 shrink-0">
                    {new Date(action.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <p className={`m-0 text-xs font-mono truncate max-w-full ${index === selectedIndex ? 'text-blue-200/70' : 'text-zinc-400'}`}>
                  {action.detail ?? 'No detail'}
                </p>
              </button>
            ))}
          </div>
        </article>

        <article className="island-shell p-5 lg:col-span-12 bg-[var(--surface-strong)] relative shadow-sm mt-2">
          <p className="island-kicker mb-4 relative z-10">Replay Frame</p>
          {currentAction ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 relative z-10">
              <div className="rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-5 shadow-sm lg:col-span-4 flex flex-col justify-center">
                <p className="m-0 text-sm font-bold text-zinc-100 flex flex-col gap-2 items-start mb-3">
                  <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">{currentAction.type}</span>
                  <span className="leading-tight">{currentAction.title}</span>
                </p>
                <p className="m-0 mt-2 text-xs font-mono leading-relaxed text-zinc-300 p-3 bg-zinc-900 rounded-md border border-[var(--line)]">
                  {currentAction.detail ?? 'No detail available for this action.'}
                </p>
                <p className="m-0 mt-4 text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  {new Date(currentAction.created_at).toLocaleString()}
                </p>
              </div>

              <div className="rounded-md border border-[var(--line)] bg-zinc-950 p-2 shadow-sm lg:col-span-8 group relative overflow-hidden flex items-center justify-center min-h-[350px]">
                {currentScreenshot?.screenshot_b64 ? (
                  <img
                    src={toScreenshotSrc(currentScreenshot.screenshot_b64)}
                    alt="Timeline screenshot"
                    className="h-auto max-h-[500px] w-full border border-[var(--line)] object-contain shadow-md transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950 text-xs text-zinc-600 p-8 text-center uppercase tracking-widest font-medium font-mono">
                    <span className="text-xl mb-3 opacity-50">🖼️</span>
                    <span>No screenshot captured</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
             <div className="rounded-md border border-dashed border-zinc-800 bg-[var(--bg-base)] p-10 text-center relative z-10 flex flex-col items-center justify-center min-h-[200px]">
               <span className="text-3xl mb-3 opacity-40">🎬</span>
               <p className="m-0 text-xs font-mono font-medium uppercase tracking-widest text-zinc-600">Select a session with actions to replay</p>
             </div>
          )}
        </article>
      </section>
    </main>
  )
}
