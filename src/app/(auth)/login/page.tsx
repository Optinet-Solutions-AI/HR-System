'use client'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-8">
        <h1 className="text-2xl font-bold text-center">WFH Sentinel</h1>
        <p className="text-center text-muted-foreground">Sign in to continue</p>
        {/* TODO: Supabase Auth login form */}
      </div>
    </div>
  )
}
