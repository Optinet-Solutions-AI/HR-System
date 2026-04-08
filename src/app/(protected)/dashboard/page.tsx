import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  const role = employee?.role

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        {role === 'hr_admin' || role === 'super_admin'
          ? 'Admin Dashboard'
          : role === 'manager'
            ? 'Team Dashboard'
            : 'Dashboard'}
      </h1>
      {/* TODO: Dashboard content — org-wide for admin, team-scoped for manager */}
    </div>
  )
}
