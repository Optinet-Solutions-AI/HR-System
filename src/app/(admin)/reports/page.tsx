import { format, startOfMonth } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/reports-client'
import {
  transformAttendance,
  transformWfhByDay,
  transformWfhPerEmployee,
  transformMonFriViolations,
} from '@/lib/reports/transform'
import { REPORT_TABS, type ReportTab } from '@/lib/types/app'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; tab?: string }
}) {
  const today = new Date()
  const from = searchParams.from ?? format(startOfMonth(today), 'yyyy-MM-dd')
  const to = searchParams.to ?? format(today, 'yyyy-MM-dd')
  const rawTab = searchParams.tab
  const tab: ReportTab =
    rawTab && (REPORT_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as ReportTab)
      : 'attendance'

  const supabase = await createServerSupabaseClient()

  const [
    { data: employees, error: empError },
    { data: records, error: recError },
    { data: wfhSchedules, error: schError },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('compliance_records')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date'),
    supabase
      .from('schedules')
      .select('*')
      .eq('status', 'wfh')
      .gte('date', from)
      .lte('date', to),
  ])

  if (empError ?? recError ?? schError) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6">
        <p className="text-destructive">
          Failed to load report data. Please try again.
        </p>
      </div>
    )
  }

  const safeEmployees = employees ?? []
  const safeRecords = records ?? []
  const safeSchedules = wfhSchedules ?? []

  return (
    <div className="container mx-auto px-4 py-4 sm:p-6">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compliance summaries and WFH usage across the organisation
        </p>
      </div>
      <ReportsClient
        from={from}
        to={to}
        tab={tab}
        attendanceRows={transformAttendance(safeRecords, safeEmployees)}
        wfhByDay={transformWfhByDay(safeSchedules)}
        wfhPerEmp={transformWfhPerEmployee(safeSchedules, safeEmployees, from, to)}
        monFriRows={transformMonFriViolations(safeRecords, safeEmployees)}
      />
    </div>
  )
}
