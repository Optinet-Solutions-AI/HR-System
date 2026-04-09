import { redirect } from 'next/navigation'
import { format, addMonths, endOfMonth, parseISO } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { WfhCalendar } from '@/components/calendar/wfh-calendar'

const MONTH_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createServerSupabaseClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch employee record
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, office_days_per_week')
    .eq('auth_user_id', user.id)
    .single()

  if (empError || !employee) redirect('/')

  // Determine target month
  const params = await searchParams
  const defaultMonth = format(addMonths(new Date(), 1), 'yyyy-MM')
  const month = params.month && MONTH_REGEX.test(params.month) ? params.month : defaultMonth

  const dateFrom = `${month}-01`
  const dateTo = format(endOfMonth(parseISO(dateFrom)), 'yyyy-MM-dd')

  // Fetch schedules, holidays, and rules in parallel
  const [schedulesResult, holidaysResult, rulesResult] = await Promise.all([
    supabase
      .from('schedules')
      .select('*')
      .eq('employee_id', employee.id)
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('public_holidays')
      .select('*')
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('schedule_rules')
      .select('*')
      .eq('is_active', true),
  ])

  if (schedulesResult.error || holidaysResult.error || rulesResult.error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">WFH Calendar</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <p className="font-medium">Failed to load calendar data</p>
          <p className="text-sm mt-1">
            {schedulesResult.error?.message ||
              holidaysResult.error?.message ||
              rulesResult.error?.message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <WfhCalendar
      employeeId={employee.id}
      officeDaysPerWeek={employee.office_days_per_week}
      month={month}
      initialSchedules={schedulesResult.data}
      publicHolidays={holidaysResult.data}
      scheduleRules={rulesResult.data}
    />
  )
}
