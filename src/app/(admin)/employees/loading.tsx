export default function EmployeesLoading() {
  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded bg-muted animate-pulse" />
        <div className="h-4 w-72 rounded bg-muted animate-pulse" />
      </div>

      {/* Table */}
      <div className="space-y-3">
        <div className="rounded-lg border">
          {/* Table header */}
          <div className="h-10 border-b bg-muted/30 animate-pulse" />
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 h-14 border-b last:border-b-0 px-4">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-4 w-16 rounded bg-muted animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
