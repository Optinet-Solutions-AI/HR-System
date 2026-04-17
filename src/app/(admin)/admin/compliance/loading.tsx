export default function AdminComplianceLoading() {
  return (
    <div className="px-4 py-4 sm:p-6 space-y-4">
      {/* Header + week nav */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* Compliance grid */}
      <div className="overflow-x-auto">
        <div className="rounded-lg border min-w-[500px]">
          {/* Header: employee + Mon–Fri */}
          <div className="flex border-b bg-muted/30">
            <div className="w-40 shrink-0 border-r p-3">
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
              <div key={d} className="flex-1 border-r last:border-r-0 p-3 text-center">
                <div className="h-4 w-8 rounded bg-muted animate-pulse mx-auto" />
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex border-b last:border-b-0">
              <div className="w-40 shrink-0 border-r p-3">
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              </div>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex-1 border-r last:border-r-0 p-2">
                  <div className="h-8 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
