'use client'

import { useEffect } from 'react'

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <p className="font-medium text-destructive">Something went wrong</p>
        <p className="text-sm text-destructive/80 mt-1">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
