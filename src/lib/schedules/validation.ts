// Schedule validation logic
// Validates WFH day selections against configurable rules:
// - Max WFH days per week (5 - office_days_per_week)
// - Monday/Friday WFH limit (max 1 per month)
// - Public holiday conflicts
// - Custom rules from schedule_rules table

import {
  parseISO,
  getISOWeek,
  getDay,
  isMonday,
  isFriday,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns'
import type { PublicHoliday, ScheduleRule, ScheduleStatus } from '@/lib/types/app'

export interface ValidationViolation {
  type:
    | 'EXCEEDED_WFH_PER_WEEK'
    | 'WEEKEND_SELECTED'
    | 'HOLIDAY_CONFLICT'
    | 'MONDAY_FRIDAY_LIMIT'
    | 'INVALID_DATE'
    | 'READ_ONLY'
  message: string
  dates: string[]
  weekNumber?: number
}

interface ScheduleSelection {
  date: string
  status: ScheduleStatus
}

interface ValidateParams {
  month: string // "YYYY-MM"
  selections: ScheduleSelection[]
  officeDaysPerWeek: number
  publicHolidays: PublicHoliday[]
  scheduleRules: ScheduleRule[]
}

export function validateScheduleSelections(
  params: ValidateParams
): { valid: boolean; violations: ValidationViolation[] } {
  const { month, selections, officeDaysPerWeek, publicHolidays, scheduleRules } = params
  const violations: ValidationViolation[] = []
  const wfhPerWeek = 5 - officeDaysPerWeek

  // Rule: read-only guard
  if (officeDaysPerWeek === 5) {
    const wfhSelections = selections.filter((s) => s.status === 'wfh')
    if (wfhSelections.length > 0) {
      violations.push({
        type: 'READ_ONLY',
        message: 'Your schedule requires 5 office days per week. WFH is not available.',
        dates: wfhSelections.map((s) => s.date),
      })
    }
    return { valid: violations.length === 0, violations }
  }

  const monthStart = startOfMonth(parseISO(`${month}-01`))
  const monthEnd = endOfMonth(monthStart)
  const holidayDates = new Set(publicHolidays.map((h) => h.date))

  for (const selection of selections) {
    const date = parseISO(selection.date)

    // Rule: dates must be within month
    if (!isWithinInterval(date, { start: monthStart, end: monthEnd })) {
      violations.push({
        type: 'INVALID_DATE',
        message: `Date ${selection.date} is not within ${month}.`,
        dates: [selection.date],
      })
      continue
    }

    // Rule: no weekends
    const dayOfWeek = getDay(date)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      violations.push({
        type: 'WEEKEND_SELECTED',
        message: `${selection.date} is a weekend day.`,
        dates: [selection.date],
      })
      continue
    }

    // Rule: no holiday conflicts
    if (holidayDates.has(selection.date)) {
      violations.push({
        type: 'HOLIDAY_CONFLICT',
        message: `${selection.date} is a public holiday.`,
        dates: [selection.date],
      })
    }
  }

  // Rule: WFH per week limit
  const wfhByWeek = new Map<number, string[]>()
  for (const selection of selections) {
    if (selection.status === 'wfh') {
      const date = parseISO(selection.date)
      const week = getISOWeek(date)
      const existing = wfhByWeek.get(week) ?? []
      existing.push(selection.date)
      wfhByWeek.set(week, existing)
    }
  }

  wfhByWeek.forEach((dates, week) => {
    if (dates.length > wfhPerWeek) {
      violations.push({
        type: 'EXCEEDED_WFH_PER_WEEK',
        message: `Week ${week}: ${dates.length} WFH days selected, maximum is ${wfhPerWeek}.`,
        dates,
        weekNumber: week,
      })
    }
  })

  // Rule: Monday/Friday limit
  const mondayFridayLimits = getMondayFridayLimits(scheduleRules)
  const wfhMondays = selections.filter(
    (s) => s.status === 'wfh' && isMonday(parseISO(s.date))
  )
  const wfhFridays = selections.filter(
    (s) => s.status === 'wfh' && isFriday(parseISO(s.date))
  )

  if (wfhMondays.length > mondayFridayLimits.monday) {
    violations.push({
      type: 'MONDAY_FRIDAY_LIMIT',
      message: `${wfhMondays.length} WFH Mondays selected, maximum is ${mondayFridayLimits.monday} per month.`,
      dates: wfhMondays.map((s) => s.date),
    })
  }

  if (wfhFridays.length > mondayFridayLimits.friday) {
    violations.push({
      type: 'MONDAY_FRIDAY_LIMIT',
      message: `${wfhFridays.length} WFH Fridays selected, maximum is ${mondayFridayLimits.friday} per month.`,
      dates: wfhFridays.map((s) => s.date),
    })
  }

  return { valid: violations.length === 0, violations }
}

function getMondayFridayLimits(rules: ScheduleRule[]): {
  monday: number
  friday: number
} {
  let monday = 1
  let friday = 1

  for (const rule of rules) {
    if (rule.rule_type !== 'MAX_WFH_PER_DAY_OF_WEEK' || !rule.is_active) continue
    const value = rule.value as { dayOfWeek?: string; maxPerMonth?: number }
    if (value.dayOfWeek === 'Monday' && typeof value.maxPerMonth === 'number') {
      monday = value.maxPerMonth
    }
    if (value.dayOfWeek === 'Friday' && typeof value.maxPerMonth === 'number') {
      friday = value.maxPerMonth
    }
  }

  return { monday, friday }
}
