import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { format, endOfMonth, parseISO } from 'date-fns'
import { validateScheduleSelections } from '@/lib/schedules/validation'

const validateSchema = z.object({
  month: z.string().regex(
    /^\d{4}-(?:0[1-9]|1[0-2])$/,
    'Month must be in YYYY-MM format'
  ),
  selections: z.array(
    z.object({
      date: z.string().date(),
      status: z.enum(['office', 'wfh']),
    })
  ),
})

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate body
  const body = await request.json()
  const parsed = validateSchema.safeParse(body)
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

  // Fetch public holidays and schedule rules
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

  const validation = validateScheduleSelections({
    month,
    selections,
    officeDaysPerWeek: employee.office_days_per_week,
    publicHolidays: holidaysResult.data,
    scheduleRules: rulesResult.data,
  })

  return Response.json({
    valid: validation.valid,
    violations: validation.violations,
  })
}
