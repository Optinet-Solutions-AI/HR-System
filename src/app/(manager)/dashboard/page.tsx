import { format } from 'date-fns'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { transformDashboardData } from '@/lib/dashboard/transform'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'

export default async function ManagerDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!me) redirect('/login')

  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('manager_id', me.id)
    .maybeSingle()

  if (!team) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-muted-foreground">No team has been assigned to you yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Contact HR to get a team assigned.</p>
        </div>
      </div>
    )
  }

  const [employeesRes, schedulesRes, clockingsRes, complianceRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name'),
    supabase.from('schedules').select('employee_id, status').eq('date', today),
    supabase.from('clockings').select('employee_id, time_in, time_out').eq('date', today),
    supabase
      .from('compliance_records')
      .select('employee_id, actual_status, is_compliant, flags, expected_status')
      .eq('date', today),
  ])

  const error =
    employeesRes.error ?? schedulesRes.error ?? clockingsRes.error ?? complianceRes.error

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6">
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          Failed to load dashboard data: {error.message}
        </div>
      </div>
    )
  }

  const data = transformDashboardData(
    employeesRes.data ?? [],
    schedulesRes.data ?? [],
    clockingsRes.data ?? [],
    complianceRes.data ?? [],
    today,
  )

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {team.name} &mdash; {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>
      <AdminDashboard initialData={data} />
    </div>
  )
}
