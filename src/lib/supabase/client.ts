import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

// Lazy singleton for demo mode — created once, reused across all browser calls.
let _mockBrowserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createBrowserSupabaseClient() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    if (!_mockBrowserClient) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createMockSupabaseClient } = require('@/lib/mock/client')
      _mockBrowserClient = createMockSupabaseClient()
    }
    return _mockBrowserClient!
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
