import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'
import { TEST_USERS } from './fixtures/test-users'

config({ path: path.join(__dirname, '../.env.local') })

export default async function globalSetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      'Run `npx supabase start` and check .env.local.',
    )
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emails = Object.values(TEST_USERS).map(u => u.email)

  // Idempotent: remove any leftover users from a previous interrupted run
  const { data: leftover } = await admin
    .from('employees')
    .select('auth_user_id')
    .in('email', emails)

  for (const emp of leftover ?? []) {
    if (emp.auth_user_id) {
      await admin.auth.admin.deleteUser(emp.auth_user_id)
    }
  }
  await admin.from('employees').delete().in('email', emails)

  // Create fresh test users
  for (const user of Object.values(TEST_USERS)) {
    const { data, error: authError } = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // bypasses email confirmation on local Supabase
    })

    if (authError) {
      throw new Error(`Failed to create auth user ${user.email}: ${authError.message}`)
    }

    const { error: empError } = await admin.from('employees').insert({
      auth_user_id: data.user.id,
      talexio_id:   user.talexioId,
      first_name:   user.firstName,
      last_name:    user.lastName,
      email:        user.email,
      office_days_per_week: user.officeDaysPerWeek,
      role:         user.role,
    })

    if (empError) {
      throw new Error(`Failed to create employee ${user.email}: ${empError.message}`)
    }
  }

  console.log('✓ E2E test users provisioned')
}
