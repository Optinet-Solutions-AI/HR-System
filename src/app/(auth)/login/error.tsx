'use client'

import { useEffect } from 'react'

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 space-y-4">
          <h2 className="text-xl font-bold">Sign in</h2>
          <p className="font-medium text-destructive">Something went wrong</p>
          <p className="text-sm text-destructive/80">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
