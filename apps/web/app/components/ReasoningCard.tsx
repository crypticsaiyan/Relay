export interface ReasoningCardProps {
  thought: string
  isLive?: boolean
}

export function ReasoningCard({ thought, isLive = false }: ReasoningCardProps) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {isLive && (
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
        )}
        <p className="island-kicker mb-0">Agent Reasoning</p>
      </div>
      <p className="m-0 text-xs leading-relaxed text-zinc-300">
        "{thought}"
      </p>
    </div>
  )
}
