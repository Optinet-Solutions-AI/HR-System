import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/app'

const ROLE_DESTINATIONS: Record<UserRole, string> = {
  employee: '/calendar',
  manager: '/manager/dashboard',
  hr_admin: '/admin/dashboard',
  super_admin: '/admin/dashboard',
}

export default async function Home() {
  // Demo mode: skip auth, go straight to admin dashboard
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    redirect('/admin/dashboard')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found; any other error is unexpected
    throw new Error(error.message)
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full mx-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access Pending</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your account (<span className="font-medium text-gray-700 dark:text-gray-300">{user.email}</span>) has
            been created but hasn&apos;t been linked to an employee record yet.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please contact your HR administrator to complete your setup.
          </p>
          <form action="/auth/signout" method="POST" className="mt-6">
            <button
              type="submit"
              className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    )
  }

  redirect(ROLE_DESTINATIONS[employee.role])
}
