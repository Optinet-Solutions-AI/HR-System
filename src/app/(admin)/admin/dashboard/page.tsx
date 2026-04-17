import { format } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { transformDashboardData } from '@/lib/dashboard/transform'
import { AdminDashboard } from '@/components/dashboard/admin-dashboard'

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [employeesRes, schedulesRes, clockingsRes, complianceRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('schedules')
      .select('employee_id, status')
      .eq('date', today),
    supabase
      .from('clockings')
      .select('employee_id, time_in, time_out')
      .eq('date', today),
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
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Today&apos;s attendance overview &mdash; {format(new Date(), 'EEEE, d MMMM yyyy')}
        </p>
      </div>
      <AdminDashboard initialData={data} />
    </div>
  )
}
