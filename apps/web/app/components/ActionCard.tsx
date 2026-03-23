export interface ActionCardProps {
  type: string
  title: string
  detail?: string | null
  createdAt?: string
}

export function ActionCard({ type, title, detail, createdAt }: ActionCardProps) {
  const formatTime = (isoString?: string) => {
    if (!isoString) return ''
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000))
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`
    }
    const minutes = Math.floor(diffSeconds / 60)
    return `${minutes}:${String(diffSeconds % 60).padStart(2, '0')} ago`
  }

  const toneMaps: Record<string, string> = {
    navigate: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    type: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    click: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    read: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    decide: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    wait: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    screenshot: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300',
    redirect: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    resume: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
    stop: 'border-red-500/20 bg-red-500/10 text-red-300',
  }
  const shortType = type.trim().slice(0, 3).toUpperCase() || 'LOG'

  return (
    <div className="group rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-3 shadow-sm hover:border-zinc-700 transition-all">
      <div className="flex gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[0.6rem] font-bold tracking-wider ${toneMaps[type] ?? 'border-zinc-700 bg-zinc-800 text-zinc-300'}`}
        >
          {shortType}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="m-0 text-sm font-semibold text-zinc-200">{title}</p>
            {createdAt && (
              <p className="m-0 shrink-0 text-right text-xs text-zinc-500">{formatTime(createdAt)}</p>
            )}
          </div>
          {detail && (
            <p className="m-0 mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-400 bg-zinc-950 p-2.5 rounded-md border border-[var(--line)]">
              {detail}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
