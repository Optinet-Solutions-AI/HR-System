export default function AdminCalendarLoading() {
  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded bg-muted animate-pulse" />
          <div className="h-4 w-56 rounded bg-muted animate-pulse" />
        </div>
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
          <div className="h-5 w-28 rounded bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="rounded-lg border min-w-[700px]">
          {/* Header row: employee name col + date cols */}
          <div className="flex border-b bg-muted/30">
            <div className="w-36 shrink-0 border-r p-3">
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            {Array.from({ length: 22 }).map((_, i) => (
              <div key={i} className="flex-1 border-r last:border-r-0 p-2 text-center">
                <div className="h-4 w-6 rounded bg-muted animate-pulse mx-auto" />
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex border-b last:border-b-0">
              <div className="w-36 shrink-0 border-r p-3">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              </div>
              {Array.from({ length: 22 }).map((_, j) => (
                <div key={j} className="flex-1 border-r last:border-r-0 p-1">
                  <div className="h-7 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
