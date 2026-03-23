import { useEffect, useMemo, useState } from 'react'
import {
  ensureRelayPowerSyncConnected,
  issueControlCommand,
  setSessionShareToken,
  watchRecentSessions,
  watchSessionActions,
  watchSessionReasoning,
} from '../lib/powersync'

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

export default function HandoffPage() {
  const [ready, setReady] = useState(false)
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
      await setSessionShareToken({ sessionId: selectedSessionId, shareToken: token })

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

      await issueControlCommand({
        sessionId: selectedSessionId,
        command: 'redirect',
        payload,
        issuedBy: issuedBy.trim() || 'handoff-operator',
      })

      setStatus('Resume context command sent.')
    } catch (cause) {
      setError(`Failed to send resume context: ${String(cause)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 md:p-8 shadow-sm">
        <div className="relative z-10">
          <p className="island-kicker mb-2 text-zinc-400">Relay Phase 8</p>
          <h1 className="display-title text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Handoff + Resume Center
          </h1>
          <p className="m-0 mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Create share-token access, generate a handoff summary, and resume agent execution with full context.
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
        <article className="island-shell p-5 lg:col-span-4 bg-[var(--surface-strong)] relative shadow-sm">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500 relative z-10">
            Session Database
          </label>
          <select
            className="relative z-10 w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
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
            <div className="relative z-10 mt-4 rounded-md border border-[var(--line)] bg-[var(--bg-base)] p-4 text-xs text-zinc-300 shadow-sm space-y-2">
              <p className="m-0 font-medium font-mono">
                <span className="text-zinc-500 mr-2 uppercase text-[10px] tracking-wider font-bold">Task:</span>
                {selectedSession.original_task}
              </p>
              <p className="m-0 font-medium font-mono">
                <span className="text-zinc-500 mr-2 uppercase text-[10px] tracking-wider font-bold">Started:</span>
                {new Date(selectedSession.started_at).toLocaleString()}
              </p>
              <p className="m-0 font-medium font-mono">
                <span className="text-zinc-500 mr-2 uppercase text-[10px] tracking-wider font-bold">Token:</span>
                {selectedSession.share_token ?? <span className="text-zinc-500 italic">not set</span>}
              </p>
            </div>
          )}

          <button
            className="relative z-10 mt-4 w-full rounded-md border border-blue-500 bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
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
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs text-zinc-300 font-mono shadow-inner outline-none focus:border-blue-500 custom-scrollbar"
                rows={3}
                value={shareLink}
                readOnly
              />
              <button
                className="w-full rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-200 shadow-sm transition-all flex items-center justify-center focus:ring-2 focus:ring-zinc-500/40 focus:outline-none"
                onClick={() => {
                  void copyShareLink()
                }}
              >
                Copy Share Link
              </button>
            </div>
          )}
        </article>

        <article className="island-shell p-5 lg:col-span-8 bg-[var(--surface-strong)] relative shadow-sm">
          <p className="island-kicker mb-3">Generated Summary</p>
          <textarea
            className="min-h-[220px] w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-3 text-xs text-zinc-300 font-mono leading-relaxed shadow-sm outline-none focus:border-blue-500 custom-scrollbar"
            value={summary}
            readOnly
          />
        </article>

        <article className="island-shell p-6 lg:col-span-12 bg-[var(--surface-strong)] relative shadow-sm mt-2">
          <p className="island-kicker mb-4 relative z-10">Resume With Context</p>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 relative z-10">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Issued By
              </label>
              <input
                value={issuedBy}
                onChange={(event) => setIssuedBy(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono shadow-sm"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Resume Target
              </label>
              <input
                value={resumeTarget}
                onChange={(event) => setResumeTarget(event.target.value)}
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono shadow-sm"
              />
            </div>
          </div>

          <button
            className="relative z-10 mt-5 w-full rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-semibold tracking-wide text-zinc-200 shadow-sm transition-all focus:ring-2 focus:ring-zinc-500/40 focus:outline-none"
            disabled={!selectedSessionId || busy || !summary}
            onClick={() => {
              void resumeWithContext()
            }}
          >
            Send Resume Context
          </button>
        </article>
      </section>
    </main>
  )
}
