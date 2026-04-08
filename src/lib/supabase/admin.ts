import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Admin client bypasses RLS — use ONLY in:
// - Cron jobs (sync-talexio, daily-compliance)
// - Compliance engine
// - Server-side admin operations
// NEVER import this in client components or "use client" files.

export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
