/**
 * One-time script: creates Supabase Auth users for all employees
 * and links them via auth_user_id in the employees table.
 *
 * Usage: node scripts/setup-auth-users.mjs
 * Delete this file after running.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://akezlvurwsmhghmrhotf.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZXpsdnVyd3NtaGdobXJob3RmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTY2MjI1NSwiZXhwIjoyMDkxMjM4MjU1fQ.erBBxGXW_rBprIpViLtQrz5TWWdFFZKVsltcCrJWl00'

// Temporary password for all employees — they should change this on first login
const DEFAULT_PASSWORD = 'Sentinel@2026!'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const employees = [
  { email: 'niklas@company.com',     firstName: 'Niklas',     lastName: 'Wirth' },
  { email: 'mohamed@company.com',    firstName: 'Mohamed',    lastName: 'AlJebali' },
  { email: 'yassine@company.com',    firstName: 'Yassine',    lastName: 'Ridene' },
  { email: 'youssef@company.com',    firstName: 'Youssef',    lastName: 'Ayedi' },
  { email: 'esam@company.com',       firstName: 'Esam',       lastName: 'Ridene' },
  { email: 'ada@company.com',        firstName: 'Ada',        lastName: 'Svardal' },
  { email: 'janice@company.com',     firstName: 'Janice',     lastName: 'Santangelo' },
  { email: 'olivier@company.com',    firstName: 'Olivier',    lastName: 'Unknown' },
  { email: 'owen@company.com',       firstName: 'Owen',       lastName: 'Ordway' },
  { email: 'redvers@company.com',    firstName: 'Redvers',    lastName: 'Whitehead' },
  { email: 'salvatore@company.com',  firstName: 'Salvatore',  lastName: 'Dolce' },
  { email: 'tina@company.com',       firstName: 'Tina',       lastName: 'Koepf' },
  { email: 'darren@company.com',     firstName: 'Darren',     lastName: 'Zahra' },
  { email: 'alec@company.com',       firstName: 'Alec',       lastName: 'Zanussi' },
  { email: 'christian@company.com',  firstName: 'Christian',  lastName: 'Deeken' },
]

async function getExistingUser(email) {
  // Search through paginated user list for existing user
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 50 })
    if (error || !data?.users?.length) break
    const found = data.users.find(u => u.email === email)
    if (found) return found
    if (data.users.length < 50) break
    page++
  }
  return null
}

async function main() {
  console.log(`Setting up auth users for ${employees.length} employees...\n`)

  let created = 0
  let linked = 0
  let skipped = 0
  let errors = 0

  for (const emp of employees) {
    process.stdout.write(`${emp.email} ... `)

    let userId = null

    // 1. Try to create the auth user
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,  // skip email confirmation
      user_metadata: { first_name: emp.firstName, last_name: emp.lastName }
    })

    if (createError) {
      if (createError.message.toLowerCase().includes('already') ||
          createError.message.toLowerCase().includes('exists') ||
          createError.status === 422) {
        // User already exists — look them up
        const existing = await getExistingUser(emp.email)
        if (existing) {
          userId = existing.id
          process.stdout.write('(already exists) ')
          skipped++
        } else {
          console.log(`ERROR — could not find existing user: ${createError.message}`)
          errors++
          continue
        }
      } else {
        console.log(`ERROR creating — ${createError.message}`)
        errors++
        continue
      }
    } else {
      userId = createData.user.id
      created++
    }

    // 2. Link auth_user_id in employees table
    const { error: updateError } = await supabase
      .from('employees')
      .update({ auth_user_id: userId })
      .eq('email', emp.email)

    if (updateError) {
      console.log(`ERROR linking — ${updateError.message}`)
      errors++
    } else {
      console.log(`OK (${userId})`)
      linked++
    }
  }

  console.log('\n=============================')
  console.log(`Created:  ${created} new auth users`)
  console.log(`Skipped:  ${skipped} already existed`)
  console.log(`Linked:   ${linked} employees updated`)
  console.log(`Errors:   ${errors}`)
  console.log('=============================')
  console.log(`\nAll employees can now log in with password: ${DEFAULT_PASSWORD}`)
  console.log('Remind them to change their password after first login.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
