import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { TEST_USERS } from './fixtures/test-users'

config({ path: path.join(__dirname, '../.env.local') })

export default async function globalTeardown() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) return

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emails = Object.values(TEST_USERS).map(u => u.email)

  // Collect auth_user_ids before deleting employee rows
  const { data: employees } = await admin
    .from('employees')
    .select('auth_user_id')
    .in('email', emails)

  // Delete employee rows — schedules CASCADE via FK
  await admin.from('employees').delete().in('email', emails)

  // Delete auth users
  for (const emp of employees ?? []) {
    if (emp.auth_user_id) {
      await admin.auth.admin.deleteUser(emp.auth_user_id)
    }
  }

  console.log('✓ E2E test users removed')
}
