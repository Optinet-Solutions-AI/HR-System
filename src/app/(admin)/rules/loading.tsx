export default function RulesLoading() {
  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </div>

      {/* Tab list */}
      <div className="flex gap-1">
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
      </div>

      {/* Rule cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 rounded bg-muted animate-pulse" />
                <div className="h-4 w-64 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-8 w-16 rounded-md bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
