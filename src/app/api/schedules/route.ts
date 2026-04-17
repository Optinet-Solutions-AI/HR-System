import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { format, endOfMonth, parseISO } from 'date-fns'
import { validateScheduleSelections } from '@/lib/schedules/validation'

const monthParamSchema = z.string().regex(
  /^\d{4}-(?:0[1-9]|1[0-2])$/,
  'Month must be in YYYY-MM format'
)

const saveScheduleSchema = z.object({
  month: monthParamSchema,
  selections: z.array(
    z.object({
      date: z.string().date(),
      status: z.enum(['office', 'wfh']),
    })
  ),
})

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse month param
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const parsed = monthParamSchema.safeParse(monthParam)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid month parameter. Use YYYY-MM format.' }, { status: 400 })
  }
  const month = parsed.data

  // Fetch employee record
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, office_days_per_week')
    .eq('auth_user_id', user.id)
    .single()

  if (empError || !employee) {
    return Response.json({ error: 'Employee record not found' }, { status: 404 })
  }

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

  if (schedulesResult.error) {
    return Response.json({ error: schedulesResult.error.message }, { status: 500 })
  }
  if (holidaysResult.error) {
    return Response.json({ error: holidaysResult.error.message }, { status: 500 })
  }
  if (rulesResult.error) {
    return Response.json({ error: rulesResult.error.message }, { status: 500 })
  }

  return Response.json({
    data: {
      employee: {
        id: employee.id,
        office_days_per_week: employee.office_days_per_week,
      },
      schedules: schedulesResult.data,
      publicHolidays: holidaysResult.data,
      scheduleRules: rulesResult.data,
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate body
  const body = await request.json()
  const parsed = saveScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { month, selections } = parsed.data

  // Fetch employee record
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, office_days_per_week')
    .eq('auth_user_id', user.id)
    .single()

  if (empError || !employee) {
    return Response.json({ error: 'Employee record not found' }, { status: 404 })
  }

  // Fetch public holidays and schedule rules for validation
  const dateFrom = `${month}-01`
  const dateTo = format(endOfMonth(parseISO(dateFrom)), 'yyyy-MM-dd')

  const [holidaysResult, rulesResult] = await Promise.all([
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

  if (holidaysResult.error) {
    return Response.json({ error: holidaysResult.error.message }, { status: 500 })
  }
  if (rulesResult.error) {
    return Response.json({ error: rulesResult.error.message }, { status: 500 })
  }

  // Server-side validation
  const validation = validateScheduleSelections({
    month,
    selections,
    officeDaysPerWeek: employee.office_days_per_week,
    publicHolidays: holidaysResult.data,
    scheduleRules: rulesResult.data,
  })

  if (!validation.valid) {
    return Response.json(
      { error: 'Validation failed', violations: validation.violations },
      { status: 400 }
    )
  }

  // Reject if the month is already published/locked
  const [monthNum, yearNum] = [parseInt(month.slice(5), 10), parseInt(month.slice(0, 4), 10)]
  const { data: lock } = await supabase
    .from('schedule_locks')
    .select('id')
    .eq('month', monthNum)
    .eq('year', yearNum)
    .maybeSingle()

  if (lock) {
    return Response.json(
      { error: 'This month has been published and can no longer be modified.' },
      { status: 403 }
    )
  }

  // Upsert schedule entries
  const { error: upsertError } = await supabase
    .from('schedules')
    .upsert(
      selections.map((s) => ({
        employee_id: employee.id,
        date: s.date,
        status: s.status,
      })),
      { onConflict: 'employee_id,date' }
    )

  if (upsertError) {
    return Response.json({ error: upsertError.message }, { status: 500 })
  }

  return Response.json({ data: { saved: selections.length } })
}
