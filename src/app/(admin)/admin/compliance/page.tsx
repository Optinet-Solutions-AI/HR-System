import { redirect } from 'next/navigation'
import { format, parseISO, startOfISOWeek, addDays, getDay } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ComplianceWeeklyGrid } from '@/components/compliance/compliance-weekly-grid'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Determine target week (default: current ISO week's Monday)
  const params = await searchParams
  const defaultWeek = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')

  let week = defaultWeek
  if (params.week && DATE_REGEX.test(params.week)) {
    try {
      const parsed = parseISO(params.week)
      if (getDay(parsed) === 1) week = params.week
    } catch {
      // fall through to default
    }
  }

  const weekEnd = format(addDays(parseISO(week), 4), 'yyyy-MM-dd')

  // Fetch data in parallel
  const [employeesResult, complianceResult] = await Promise.all([
    supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('compliance_records')
      .select('*')
      .gte('date', week)
      .lte('date', weekEnd),
  ])

  const error = employeesResult.error ?? complianceResult.error

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Weekly Compliance</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
          <p className="font-medium">Failed to load compliance data</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <ComplianceWeeklyGrid
      employees={employeesResult.data!}
      complianceRecords={complianceResult.data!}
      week={week}
    />
  )
}
