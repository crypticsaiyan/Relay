export interface ControlBarProps {
  issuedBy: string
  onIssuedByChange: (value: string) => void
  redirectText: string
  onRedirectTextChange: (value: string) => void
  onPause?: () => void
  onStop?: () => void
  onResume?: () => void
  onSend?: () => void
  disabled?: boolean
  pending?: boolean
}

export function ControlBar({
  issuedBy,
  onIssuedByChange,
  redirectText,
  onRedirectTextChange,
  onPause,
  onStop,
  onResume,
  onSend,
  disabled = false,
  pending = false,
}: ControlBarProps) {
  const isDisabled = disabled || pending

  return (
    <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-strong)] z-10 sticky top-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="island-kicker mb-0 mr-2">Controls</p>
        <button
          className="rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled}
          onClick={onPause}
        >
          Pause
        </button>
        <button
          className="rounded-md border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled}
          onClick={onStop}
        >
          Stop
        </button>
        <button
          className="rounded-md border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled}
          onClick={onResume}
        >
          Resume
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={issuedBy}
          onChange={(e) => onIssuedByChange(e.target.value)}
          className="w-full sm:w-[120px] rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500"
          placeholder="Operator"
          disabled={isDisabled}
        />
        <input
          value={redirectText}
          onChange={(e) => onRedirectTextChange(e.target.value)}
          className="flex-1 rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-3 py-1.5 text-xs text-zinc-100 outline-none transition-all placeholder:text-zinc-600 focus:border-blue-500"
          placeholder="Redirect agent..."
          disabled={isDisabled}
        />
        <button
          className="rounded-md border border-blue-500 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isDisabled || !redirectText.trim()}
          onClick={onSend}
        >
          Send
        </button>
      </div>
    </div>
  )
}
