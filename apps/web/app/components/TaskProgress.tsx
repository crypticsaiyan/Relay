export interface ProgressItem {
  id: string
  label: string
  state: 'done' | 'current' | 'pending'
}

export interface TaskProgressProps {
  items: ProgressItem[]
}

export function TaskProgress({ items }: TaskProgressProps) {
  return (
    <div className="space-y-2 relative before:absolute before:inset-y-2 before:left-[11px] before:w-[1px] before:bg-zinc-800">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative flex items-start gap-4 text-xs bg-[var(--bg-base)] p-3 rounded-md border border-[var(--line)]"
        >
          <span
            className={`relative z-10 mt-0.5 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full ring-2 ring-[var(--surface-strong)] ${
              item.state === 'done'
                ? 'bg-zinc-500'
                : item.state === 'current'
                  ? 'bg-blue-500'
                  : 'bg-zinc-700'
            }`}
          />
          <span
            className={
              item.state === 'done'
                ? 'text-zinc-500 line-through decoration-zinc-700'
                : item.state === 'current'
                  ? 'font-medium text-zinc-200'
                  : 'text-zinc-500'
            }
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}
