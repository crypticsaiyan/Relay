import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ensureRelayPowerSyncConnected,
  issueControlCommand,
  setSessionShareToken,
  watchRecentSessions,
  watchSessionActions,
  watchSessionReasoning,
} from '../../app/lib/powersync'
import {
  fetchLocalRelaySnapshot,
  postLocalRelayControl,
  postLocalRelayShare,
} from '../../app/lib/local-relay-bridge-client'
import { USE_LOCAL_RELAY_BRIDGE } from '../../app/lib/runtime-mode'

type HandoffSearch = {
  session?: string
  share?: string
}

export const Route = createFileRoute('/handoff')({
  validateSearch: (search: Record<string, unknown>): HandoffSearch => ({
    session: typeof search.session === 'string' ? search.session : undefined,
    share: typeof search.share === 'string' ? search.share : undefined,
  }),
  component: HandoffPage,
})

type SessionRow = {
  id: string
  name: string
  status: string
  original_task: string
  started_at: string
  share_token: string | null
}

type ActionRow = {
  id: string
  type: string
  title: string
  detail: string | null
  created_at: string
  sequence_number: number
}

type ReasoningRow = {
  id: string
  thought: string
  created_at: string
}

const USE_LOCAL_BRIDGE = USE_LOCAL_RELAY_BRIDGE

function HandoffPage() {
  const search = Route.useSearch()
  const [ready, setReady] = useState(USE_LOCAL_BRIDGE)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [actions, setActions] = useState<ActionRow[]>([])
  const [reasoning, setReasoning] = useState<ReasoningRow[]>([])
  const [shareLink, setShareLink] = useState('')
  const [resumeTarget, setResumeTarget] = useState('Continue the task from the latest known state.')
  const [issuedBy, setIssuedBy] = useState('handoff-operator')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

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
        setSelectedSessionId(pickPreferredSessionId(mapped, search.session))
      }
    })

    return () => {
      stop()
    }
  }, [ready, search.session, selectedSessionId])

  useEffect(() => {
    if (!USE_LOCAL_BRIDGE || !ready) {
      return
    }

    let active = true

    const sync = async () => {
      try {
        const snapshot = await fetchLocalRelaySnapshot({
          sessionId: selectedSessionId || search.session || null,
        })

        if (!active) {
          return
        }

        const mappedSessions = snapshot.sessions as unknown as SessionRow[]
        setSessions(mappedSessions)
        setActions(snapshot.actions as unknown as ActionRow[])
        setReasoning(snapshot.reasoning as unknown as ReasoningRow[])

        const selectedStillExists =
          selectedSessionId.length > 0 &&
          mappedSessions.some((session) => session.id === selectedSessionId)

        if (!selectedStillExists) {
          setSelectedSessionId(pickPreferredSessionId(mappedSessions, search.session))
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
  }, [ready, search.session, selectedSessionId])

  useEffect(() => {
    if (!search.session) {
      return
    }

    const hasRequestedSession = sessions.some((session) => session.id === search.session)
    if (hasRequestedSession && selectedSessionId !== search.session) {
      setSelectedSessionId(search.session)
    }
  }, [search.session, selectedSessionId, sessions])

  useEffect(() => {
    if (USE_LOCAL_BRIDGE || !ready || !selectedSessionId) {
      return
    }

    const stops = [
      watchSessionActions(selectedSessionId, (rows) => {
        setActions(rows as unknown as ActionRow[])
      }),
      watchSessionReasoning(selectedSessionId, (rows) => {
        setReasoning(rows as unknown as ReasoningRow[])
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop()
      }
    }
  }, [ready, selectedSessionId])

  useEffect(() => {
    if (selectedSessionId) {
      return
    }

    setActions([])
    setReasoning([])
  }, [selectedSessionId])

  const selectedSession = useMemo(() => {
    return sessions.find((session) => session.id === selectedSessionId) ?? null
  }, [sessions, selectedSessionId])

  const summary = useMemo(() => {
    if (!selectedSession) {
      return ''
    }

    const latestActions = actions.slice(-5)
    const topReasoning = reasoning.slice(0, 3)

    const actionLines =
      latestActions.length === 0
        ? '- No actions logged yet.'
        : latestActions.map((action) => `- #${action.sequence_number} ${action.type}: ${action.title}`).join('\n')

    const reasoningLines =
      topReasoning.length === 0
        ? '- No reasoning rows available.'
        : topReasoning.map((entry) => `- ${entry.thought}`).join('\n')

    return [
      `Session: ${selectedSession.name}`,
      `Status: ${selectedSession.status}`,
      `Original task: ${selectedSession.original_task}`,
      '',
      'Recent actions:',
      actionLines,
      '',
      'Recent reasoning:',
      reasoningLines,
    ].join('\n')
  }, [selectedSession, actions, reasoning])

  const ensureShareLink = async (): Promise<void> => {
    if (!selectedSessionId || busy) {
      return
    }

    try {
      setBusy(true)
      setError('')
      setStatus('')

      const token = selectedSession?.share_token ?? `relay-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`

      if (USE_LOCAL_BRIDGE) {
        await postLocalRelayShare({
          sessionId: selectedSessionId,
          shareToken: token,
        })
      } else {
        await setSessionShareToken({ sessionId: selectedSessionId, shareToken: token })
      }

      const link = `${window.location.origin}/handoff?session=${selectedSessionId}&share=${token}`
      setShareLink(link)
      setStatus('Share token ready.')
    } catch (cause) {
      setError(`Failed to generate share token: ${String(cause)}`)
    } finally {
      setBusy(false)
    }
  }

  const copyShareLink = async (): Promise<void> => {
    if (!shareLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareLink)
      setStatus('Share link copied to clipboard.')
    } catch (cause) {
      setError(`Copy failed: ${String(cause)}`)
    }
  }

  const resumeWithContext = async (): Promise<void> => {
    if (!selectedSessionId || busy) {
      return
    }

    try {
      setBusy(true)
      setError('')
      setStatus('')

      const payload = [
        `Resume target: ${resumeTarget.trim() || 'Continue current task.'}`,
        '',
        'Handoff context:',
        summary,
      ].join('\n')

      if (USE_LOCAL_BRIDGE) {
        await postLocalRelayControl({
          sessionId: selectedSessionId,
          command: 'redirect',
          payload,
          issuedBy: issuedBy.trim() || 'handoff-operator',
        })
      } else {
        await issueControlCommand({
          sessionId: selectedSessionId,
          command: 'redirect',
          payload,
          issuedBy: issuedBy.trim() || 'handoff-operator',
        })
      }

      setStatus('Redirect context queued for the selected agent.')
    } catch (cause) {
      setError(`Failed to send resume context: ${String(cause)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm md:p-8">
        <div className="relative z-10">
          <p className="island-kicker mb-2 text-zinc-400">Relay Phase 8</p>
          <h1 className="display-title text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Handoff + Resume Center
          </h1>
          <p className="m-0 mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Create share-token access, generate a handoff summary, and send a redirect command with enough context for the selected agent to continue the work.
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

      {status && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 shadow-sm">
          {status}
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
              setShareLink('')
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
            <div className="relative z-10 mt-4 space-y-2 rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs text-zinc-300 shadow-sm">
              <p className="m-0 font-mono font-medium">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Task:</span>
                {selectedSession.original_task}
              </p>
              <p className="m-0 font-mono font-medium">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Started:</span>
                {new Date(selectedSession.started_at).toLocaleString()}
              </p>
              <p className="m-0 font-mono font-medium">
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Token:</span>
                {selectedSession.share_token ?? <span className="italic text-zinc-500">not set</span>}
              </p>
            </div>
          )}

          <button
            className="relative z-10 mt-4 w-full rounded-md border border-blue-500 bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            disabled={!selectedSessionId || busy}
            onClick={() => {
              void ensureShareLink()
            }}
          >
            Generate Share Token
          </button>

          {shareLink && (
            <div className="relative z-10 mt-4 space-y-3">
              <textarea
                className="custom-scrollbar w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs font-mono text-zinc-300 shadow-inner outline-none focus:border-blue-500"
                rows={3}
                value={shareLink}
                readOnly
              />
              <button
                className="flex w-full items-center justify-center rounded-md border border-[var(--line)] bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 shadow-sm transition-all hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
                onClick={() => {
                  void copyShareLink()
                }}
              >
                Copy Share Link
              </button>
            </div>
          )}
        </article>

        <article className="island-shell relative bg-[var(--surface-strong)] p-5 shadow-sm lg:col-span-8">
          <p className="island-kicker mb-3">Generated Summary</p>
          <textarea
            className="custom-scrollbar min-h-[220px] w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-3 text-xs leading-relaxed text-zinc-300 shadow-sm outline-none focus:border-blue-500"
            value={summary}
            readOnly
          />
        </article>

        <article className="island-shell relative mt-2 bg-[var(--surface-strong)] p-6 shadow-sm lg:col-span-12">
          <p className="island-kicker relative z-10 mb-4">Redirect With Context</p>
          <div className="relative z-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Issued By
              </label>
              <input
                value={issuedBy}
                onChange={(event) => setIssuedBy(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs font-mono text-zinc-200 outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                New Objective
              </label>
              <input
                value={resumeTarget}
                onChange={(event) => setResumeTarget(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs font-mono text-zinc-200 outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <p className="relative z-10 mt-4 text-xs leading-relaxed text-zinc-500">
            This keeps the same session alive and sends a `redirect` control command with the handoff summary attached, so the agent can switch to the new work instead of starting a brand new session.
          </p>

          <button
            className="relative z-10 mt-5 w-full rounded-md border border-[var(--line)] bg-zinc-800 px-5 py-2.5 text-xs font-semibold tracking-wide text-zinc-200 shadow-sm transition-all hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
            disabled={!selectedSessionId || busy || !summary}
            onClick={() => {
              void resumeWithContext()
            }}
          >
            Send Redirect Context
          </button>
        </article>
      </section>
    </main>
  )
}

function pickPreferredSessionId(sessions: SessionRow[], preferredSessionId?: string): string {
  if (preferredSessionId && sessions.some((session) => session.id === preferredSessionId)) {
    return preferredSessionId
  }

  return sessions[0]?.id ?? ''
}
