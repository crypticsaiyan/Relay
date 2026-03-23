import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ensureRelayPowerSyncConnected,
  getRelayPowerSyncConnectionSnapshot,
  watchRecentSessions,
  watchRelayPowerSyncConnection,
} from '../../app/lib/powersync'
import { fetchLocalRelaySnapshot } from '../../app/lib/local-relay-bridge-client'
import { getRelayRuntimeLabel, USE_LOCAL_RELAY_BRIDGE } from '../../app/lib/runtime-mode'

type SessionRow = {
  id: string
  name: string
  status: string
  last_activity_at?: string | null
}

const USE_LOCAL_BRIDGE = USE_LOCAL_RELAY_BRIDGE
const ACTIVE_SESSION_WINDOW_MS = 2 * 60 * 1000
const RECENT_SESSION_WINDOW_MS = 10 * 60 * 1000

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

function isRunningStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'running'
}

function isPausedStatus(status: string | null | undefined): boolean {
  return normalizeStatus(status) === 'paused'
}

export default function Header() {
  const [ready, setReady] = useState(
    USE_LOCAL_BRIDGE || getRelayPowerSyncConnectionSnapshot().status === 'live'
  )
  const [syncState, setSyncState] = useState(() => getRelayPowerSyncConnectionSnapshot())
  const [sessions, setSessions] = useState<SessionRow[]>([])

  useEffect(() => {
    if (USE_LOCAL_BRIDGE) {
      setReady(true)
      return
    }

    const stop = watchRelayPowerSyncConnection((snapshot) => {
      setSyncState(snapshot)
      setReady(snapshot.status === 'live')
    })

    void ensureRelayPowerSyncConnected().catch(() => undefined)

    return stop
  }, [])

  useEffect(() => {
    if (USE_LOCAL_BRIDGE || !ready) {
      return
    }

    const stop = watchRecentSessions((rows) => {
      setSessions(rows as unknown as SessionRow[])
    })

    return () => {
      stop()
    }
  }, [ready])

  useEffect(() => {
    if (!USE_LOCAL_BRIDGE || !ready) {
      return
    }

    let active = true
    const sync = async () => {
      try {
        const snapshot = await fetchLocalRelaySnapshot()
        if (active) {
          setSessions(snapshot.sessions)
        }
      } catch {
        if (active) {
          setSessions([])
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
  }, [ready])

  const sessionChip = useMemo(() => {
    const now = Date.now()

    return (
      sessions.find((session) => isSessionShownInHeader(session, now))
      ?? sessions.find((session) => isSessionRecent(session, now))
      ?? sessions[0]
      ?? null
    )
  }, [sessions])

  return (
    <header className="sticky top-0 z-50">
      <nav className="page-wrap flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 transition-all">
        <h2 className="m-0 flex-shrink-0 text-sm font-semibold tracking-wide">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-0 py-1 text-[15px] font-bold text-zinc-100 no-underline transition-opacity hover:opacity-80"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-800">
              <span className="h-2 w-2 rounded-sm bg-white" />
            </span>
            Relay
          </Link>
        </h2>

        <div className="order-3 flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide text-sm sm:order-2 sm:w-auto sm:overflow-visible">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Home
          </Link>
          <Link
            to="/live"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Live
          </Link>
          <Link
            to="/timeline"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Timeline
          </Link>
          <Link
            to="/handoff"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Handoff
          </Link>
          <Link
            to="/connect"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Connect
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--chip-bg)] px-3 py-1 text-xs text-[var(--sea-ink-soft)] lg:flex">
            <span
              className={`h-[6px] w-[6px] rounded-full ${
                isRunningStatus(sessionChip?.status)
                  ? 'bg-emerald-500'
                  : isPausedStatus(sessionChip?.status)
                    ? 'bg-amber-400'
                    : 'bg-zinc-500'
              }`}
            />
            {sessionChip ? `${sessionChip.name} · ${sessionChip.status}` : 'No recent session'}
          </div>
          <div
            className={`hidden rounded-md px-3 py-1 text-[11px] font-medium lg:block ${
              ready
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : syncState.status === 'connecting' || syncState.status === 'idle'
                  ? 'border border-blue-500/20 bg-blue-500/10 text-blue-400'
                  : 'border border-zinc-500/20 bg-zinc-500/10 text-zinc-400'
            }`}
          >
            {USE_LOCAL_BRIDGE
              ? getRelayRuntimeLabel()
              : ready
                ? 'Synced'
                : syncState.status === 'connecting' || syncState.status === 'idle'
                  ? 'Syncing'
                  : 'Offline'}
          </div>
        </div>
      </nav>
    </header>
  )
}

function isSessionShownInHeader(session: SessionRow, now: number): boolean {
  if (isPausedStatus(session.status)) {
    return true
  }

  if (!isRunningStatus(session.status)) {
    return false
  }

  const source = session.last_activity_at
  if (!source) {
    return false
  }

  return now - new Date(source).getTime() <= ACTIVE_SESSION_WINDOW_MS
}

function isSessionRecent(session: SessionRow, now: number): boolean {
  const source = session.last_activity_at
  if (!source) {
    return false
  }

  return now - new Date(source).getTime() <= RECENT_SESSION_WINDOW_MS
}
