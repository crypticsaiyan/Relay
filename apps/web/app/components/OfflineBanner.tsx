export function OfflineBanner() {
  return (
    <section className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-center gap-3">
      <span className="flex items-center justify-center h-6 w-6 bg-amber-500/20 rounded-full">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
      </span>
      <div>
        <p className="font-semibold m-0">Offline Mode Active</p>
        <p className="text-xs m-0 opacity-80 mt-1">Actions are being queued locally. They will sync when connection is restored.</p>
      </div>
    </section>
  )
}
