import { redirect } from 'next/navigation'
import { format, endOfMonth, parseISO } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminCalendarGrid } from '@/components/admin-calendar/admin-calendar-grid'

const MONTH_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createServerSupabaseClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Determine target month (default: current month)
  const params = await searchParams
  const defaultMonth = format(new Date(), 'yyyy-MM')
  const month = params.month && MONTH_REGEX.test(params.month) ? params.month : defaultMonth

  const dateFrom = `${month}-01`
  const dateTo = format(endOfMonth(parseISO(dateFrom)), 'yyyy-MM-dd')

  // Fetch all data in parallel
  const [employeesResult, schedulesResult, holidaysResult, rulesResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name, office_days_per_week')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('schedules')
      .select('employee_id, date, status')
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('public_holidays')
      .select('date, name')
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('schedule_rules')
      .select('*')
      .eq('is_active', true)
      .eq('rule_type', 'MAX_WFH_PER_DAY'),
  ])

  const error =
    employeesResult.error ?? schedulesResult.error ?? holidaysResult.error ?? rulesResult.error

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Calendar Overview</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <p className="font-medium">Failed to load calendar data</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  // Extract MAX_WFH_PER_DAY threshold
  const maxWfhRule = rulesResult.data![0]
  const maxWfhPerDay = maxWfhRule
    ? (maxWfhRule.value as { maxCount?: number }).maxCount ?? null
    : null

  return (
    <AdminCalendarGrid
      employees={employeesResult.data!}
      schedules={schedulesResult.data!}
      publicHolidays={holidaysResult.data!}
      month={month}
      maxWfhPerDay={maxWfhPerDay}
    />
  )
}
