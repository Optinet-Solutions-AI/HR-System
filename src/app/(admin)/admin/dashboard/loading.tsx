export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded bg-muted animate-pulse" />
      </div>

      {/* Status cards skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[100px] rounded-xl ring-1 ring-foreground/10 bg-card animate-pulse"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="space-y-3">
        <div className="h-9 w-64 rounded bg-muted animate-pulse" />
        <div className="rounded-lg border">
          <div className="h-10 border-b bg-muted/30 animate-pulse" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 border-b bg-muted/10 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
