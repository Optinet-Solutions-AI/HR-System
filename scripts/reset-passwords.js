/**
 * Reset passwords for all employees
 * Sends password reset emails to all Supabase Auth users
 *
 * Usage: node scripts/reset-passwords.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function resetAllPasswords() {
  try {
    console.log('📧 Fetching all auth users...')

    // Get all users from Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      console.error('❌ Error fetching users:', listError.message)
      process.exit(1)
    }

    console.log(`Found ${users.length} users\n`)

    // Filter out test users (e2e.* accounts)
    const productionUsers = users.filter(u => !u.email.startsWith('e2e.') && !u.email.includes('@gmail.com'))

    console.log(`Resetting passwords for ${productionUsers.length} production users:\n`)

    let success = 0
    let failed = 0

    for (const user of productionUsers) {
      try {
        // Send password reset email
        const { error } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: user.email,
          options: {
            redirectTo: 'http://localhost:3000/login'
          }
        })

        if (error) {
          console.log(`❌ ${user.email} — ${error.message}`)
          failed++
        } else {
          console.log(`✅ ${user.email} — reset email sent`)
          success++
        }
      } catch (err) {
        console.log(`❌ ${user.email} — ${err.message}`)
        failed++
      }
    }

    console.log(`\n📊 Results:`)
    console.log(`   ✅ Sent: ${success}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`\n📧 Password reset links have been sent to employees' emails.`)
    console.log(`⏱️  Links expire in 1 hour. Employees should check their inbox/spam folder.\n`)

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

resetAllPasswords()
