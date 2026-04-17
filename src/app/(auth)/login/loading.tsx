export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        {/* Logo skeleton */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
            <div className="h-5 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>

        {/* Card skeleton */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {/* Card header */}
          <div className="space-y-2 text-center">
            <div className="h-5 w-20 rounded bg-muted animate-pulse mx-auto" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse mx-auto" />
          </div>

          {/* Email field */}
          <div className="space-y-2">
            <div className="h-4 w-10 rounded bg-muted animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>

          {/* Password field */}
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-muted animate-pulse" />
            <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
          </div>

          {/* Button */}
          <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}
