import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { parseISO, getISOWeek, getDay, format, startOfMonth, endOfMonth } from 'date-fns'

const validateSchema = z.object({
  employee_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  selections: z.array(
    z.object({
      date: z.string().date(),
      status: z.enum(['office', 'wfh']),
    })
  ),
})

interface Violation {
  rule: string
  message: string
  dates: string[]
}

// Day-of-week name to getDay() index (0=Sun … 6=Sat)
const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

export async function POST(request: Request) {
  // Auth check via server client (respects session cookie)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse and validate body
  const body = await request.json()
  const parsed = validateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { employee_id, month, year, selections } = parsed.data

  // Build month date range
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const dateFrom = `${monthStr}-01`
  const dateTo = format(endOfMonth(startOfMonth(parseISO(dateFrom))), 'yyyy-MM-dd')

  // Use admin client for cross-employee queries and schedule_rules
  const adminSupabase = createAdminSupabaseClient()

  // Fetch employee record and active rules in parallel
  const [empResult, rulesResult] = await Promise.all([
    adminSupabase
      .from('employees')
      .select('id, office_days_per_week')
      .eq('id', employee_id)
      .single(),
    adminSupabase
      .from('schedule_rules')
      .select('*')
      .eq('is_active', true),
  ])

  if (empResult.error || !empResult.data) {
    return Response.json({ error: 'Employee not found' }, { status: 404 })
  }
  if (rulesResult.error) {
    return Response.json({ error: rulesResult.error.message }, { status: 500 })
  }

  const employee = empResult.data
  const rules = rulesResult.data
  const wfhPerWeek = 5 - employee.office_days_per_week
  const violations: Violation[] = []

  const wfhSelections = selections.filter((s) => s.status === 'wfh')

  // ── Rule 1: Weekly WFH limit ─────────────────────────────────────────────
  // Group WFH selections by ISO week and check against per-employee limit
  const wfhByWeek = new Map<number, string[]>()
  for (const s of wfhSelections) {
    const week = getISOWeek(parseISO(s.date))
    const existing = wfhByWeek.get(week) ?? []
    existing.push(s.date)
    wfhByWeek.set(week, existing)
  }

  wfhByWeek.forEach((dates, week) => {
    if (dates.length > wfhPerWeek) {
      violations.push({
        rule: 'WEEKLY_WFH_LIMIT',
        message: `Week ${week}: ${dates.length} WFH days selected, maximum allowed is ${wfhPerWeek} (${employee.office_days_per_week} office days required per week).`,
        dates,
      })
    }
  })

  // ── Rule 2: Dynamic rules from schedule_rules table ──────────────────────
  for (const rule of rules) {
    const value = rule.value as Record<string, unknown>

    if (rule.rule_type === 'MAX_WFH_PER_DAY_OF_WEEK') {
      // Count WFH selections that fall on the specified day of week
      const dayOfWeek = value.dayOfWeek as string | undefined
      const maxPerMonth = value.maxPerMonth as number | undefined

      if (!dayOfWeek || maxPerMonth === undefined) continue

      const targetDayIndex = DAY_NAME_TO_INDEX[dayOfWeek]
      if (targetDayIndex === undefined) continue

      const matchingDates = wfhSelections
        .filter((s) => getDay(parseISO(s.date)) === targetDayIndex)
        .map((s) => s.date)

      if (matchingDates.length > maxPerMonth) {
        violations.push({
          rule: rule.rule_type,
          message: `${matchingDates.length} WFH ${dayOfWeek}s selected for ${monthStr}. Maximum allowed is ${maxPerMonth} per month.`,
          dates: matchingDates,
        })
      }
    } else if (rule.rule_type === 'MAX_WFH_PER_DAY') {
      // Count total employees with WFH on each date across the org
      const maxCount = value.maxCount as number | undefined
      if (maxCount === undefined) continue

      // Only check dates where this employee selected WFH
      const wfhDates = wfhSelections.map((s) => s.date)
      if (wfhDates.length === 0) continue

      // Fetch existing WFH schedules for these dates from other employees
      const { data: existingSchedules, error: schedError } = await adminSupabase
        .from('schedules')
        .select('date, employee_id')
        .in('date', wfhDates)
        .eq('status', 'wfh')
        .neq('employee_id', employee_id)
        .gte('date', dateFrom)
        .lte('date', dateTo)

      if (schedError) {
        return Response.json({ error: schedError.message }, { status: 500 })
      }

      // Count existing WFH per date (excluding this employee)
      const existingCountByDate = new Map<string, number>()
      for (const sched of existingSchedules) {
        existingCountByDate.set(
          sched.date,
          (existingCountByDate.get(sched.date) ?? 0) + 1
        )
      }

      const overCapacityDates = wfhDates.filter(
        (date) => (existingCountByDate.get(date) ?? 0) + 1 > maxCount
      )

      if (overCapacityDates.length > 0) {
        violations.push({
          rule: rule.rule_type,
          message: `WFH capacity limit of ${maxCount} employee${maxCount !== 1 ? 's' : ''} per day exceeded on ${overCapacityDates.length} date${overCapacityDates.length !== 1 ? 's' : ''}.`,
          dates: overCapacityDates,
        })
      }
    }
  }

  return Response.json({
    valid: violations.length === 0,
    violations,
  })
}
