import { useEffect, useState } from 'react'
import { OfflineBanner } from '../components/OfflineBanner'

export default function DemoPage() {
  const [isOffline, setIsOffline] = useState(false)
  const [queuedActions, setQueuedActions] = useState<string[]>([])

  useEffect(() => {
    // Simulate queued actions when offline
    if (isOffline) {
      const actions = [
        'navigate to checkout',
        'fill payment form',
        'submit order',
        'verify confirmation',
      ]
      let current = 0
      const timer = setInterval(() => {
        if (current < actions.length) {
          setQueuedActions((prev) => [...prev, actions[current]])
          current++
        }
      }, 1500)

      return () => clearInterval(timer)
    } else {
      setQueuedActions([])
    }
  }, [isOffline])

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      {isOffline && <OfflineBanner />}

      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 md:p-8 shadow-sm">
        <div className="relative z-10">
          <p className="island-kicker mb-2 text-zinc-400">Relay Phase 9</p>
          <h1 className="display-title text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Demo Mode & Offline Capability
          </h1>
          <p className="m-0 mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Experience Relay's local-first architecture with offline-first queuing and seamless reconnection.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="island-shell p-6 bg-[var(--surface-strong)] shadow-sm">
          <p className="island-kicker mb-4">Demo Controls</p>
          <div className="space-y-3">
            <button
              onClick={() => setIsOffline(!isOffline)}
              className={`w-full px-4 py-3 rounded-md font-semibold text-sm transition-all ${
                isOffline
                  ? 'bg-red-500/20 border border-red-500 text-red-300 hover:bg-red-500/30'
                  : 'bg-emerald-500/20 border border-emerald-500 text-emerald-300 hover:bg-emerald-500/30'
              }`}
            >
              {isOffline ? '🔴 Go Offline' : '🟢 Go Online'}
            </button>
            <p className="text-xs text-zinc-500">
              {isOffline
                ? 'Simulating offline mode. Actions will be queued locally.'
                : 'Online mode active. All actions sync immediately.'}
            </p>
          </div>
        </article>

        <article className="island-shell p-6 bg-[var(--surface-strong)] shadow-sm">
          <p className="island-kicker mb-4">Connection Status</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}
              />
              <span className="text-zinc-300">
                {isOffline ? 'Offline (Local Queue Active)' : 'Online (Direct Sync)'}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-3">
              <p className="font-semibold text-zinc-400 mb-2">Features:</p>
              <ul className="space-y-1">
                <li>✓ Local SQLite persistence</li>
                <li>✓ Automatic re-sync on reconnect</li>
                <li>✓ Queue visualization</li>
                <li>✓ Real-time status updates</li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
        <p className="island-kicker mb-4">Queued Actions {isOffline && `(${queuedActions.length})`}</p>
        <div className="space-y-2 min-h-[100px] bg-[var(--bg-base)] p-4 rounded-md border border-[var(--line)]">
          {queuedActions.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">
              {isOffline ? 'Waiting for actions...' : 'No queued actions (online mode)'}
            </p>
          ) : (
            queuedActions.map((action, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs text-zinc-300 animate-in fade-in slide-in-from-left"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="font-mono">
                  [{new Date().toLocaleTimeString()}] {action}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
        <p className="island-kicker mb-4">How It Works</p>
        <div className="space-y-3 text-sm text-zinc-300">
          <p>
            Relay uses PowerSync's local-first sync engine to ensure that your agent's actions are never lost, even when
            offline.
          </p>
          <ol className="space-y-2 text-xs text-zinc-400 list-decimal list-inside ml-2">
            <li>Actions are written to local SQLite immediately</li>
            <li>When offline, writes queue in local storage</li>
            <li>Browser automatically syncs when reconnected</li>
            <li>PowerSync reconciles and updates the server</li>
            <li>Both agent and operator see consistent state</li>
          </ol>
          <p className="text-xs text-zinc-500 italic mt-4">
            Try toggling offline mode above to see local-first queueing in action.
          </p>
        </div>
      </section>
    </main>
  )
}
