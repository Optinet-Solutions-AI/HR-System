// src/lib/auth/require-hr-admin.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

type AuthError = { error: string; status: 401 | 403; client: null }
type AuthSuccess = { error: null; status: 200; client: SupabaseClient<Database> }

export async function requireHrAdmin(): Promise<AuthError | AuthSuccess> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, client: null }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return { error: 'Forbidden', status: 403, client: null }
  }

  return { error: null, status: 200, client: supabase }
}
