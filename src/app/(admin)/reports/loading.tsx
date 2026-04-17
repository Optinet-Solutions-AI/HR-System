export default function ReportsLoading() {
  return (
    <div className="container mx-auto px-4 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-24 rounded bg-muted animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse" />
      </div>

      {/* Date range bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-9 w-36 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse ml-auto" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-32 rounded-t-md bg-muted animate-pulse" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <div className="h-10 border-b bg-muted/30 animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 h-12 border-b last:border-b-0 px-4">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
