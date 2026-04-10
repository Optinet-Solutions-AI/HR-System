import { getDay, parseISO, format, differenceInDays } from 'date-fns'
import type { ComplianceRecord, Schedule, Employee, ComplianceFlag } from '@/lib/types/app'

// ─── Output types ─────────────────────────────────────────────────────────────

export type AttendanceRow = {
  employee_id: string
  first_name: string
  last_name: string
  total_days: number
  compliant_days: number
  compliance_rate: number                          // 0–100, one decimal place
  flag_counts: Partial<Record<ComplianceFlag, number>>
  most_common_flag: ComplianceFlag | null
}

export type WfhByDayRow = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
  wfh_count: number
  pct_of_total: number                             // 0–100, one decimal place
}

export type WfhPerEmpRow = {
  employee_id: string
  first_name: string
  last_name: string
  wfh_days: number
  total_wfh_entitlement: number
  utilisation_rate: number                         // 0–100, one decimal place
}

export type MonFriRow = {
  employee_id: string
  first_name: string
  last_name: string
  month: string                                    // "April 2026"
  monday_wfh: number                               // violation count on Mondays this month
  friday_wfh: number                               // violation count on Fridays this month
  violation_count: number                          // monday_wfh + friday_wfh
  violation_dates: string[]                        // ["Apr 7", "Apr 21"]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WFH_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
type WfhDay = typeof WFH_DAYS[number]

const DAY_BY_INDEX: Record<number, string> = {
  0: 'Saturday', 1: 'Sunday', 2: 'Monday', 3: 'Tuesday',
  4: 'Wednesday', 5: 'Thursday', 6: 'Friday',
}

function oneDecimal(n: number): number {
  return Math.round(n * 10) / 10
}

// ─── Transforms ───────────────────────────────────────────────────────────────

export function transformAttendance(
  records: ComplianceRecord[],
  employees: Employee[],
): AttendanceRow[] {
  const empMap = new Map(employees.map(e => [e.id, e]))
  const byEmployee = new Map<string, AttendanceRow>()

  for (const record of records) {
    const emp = empMap.get(record.employee_id)
    if (!emp) continue

    if (!byEmployee.has(record.employee_id)) {
      byEmployee.set(record.employee_id, {
        employee_id: record.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        total_days: 0,
        compliant_days: 0,
        compliance_rate: 0,
        flag_counts: {},
        most_common_flag: null,
      })
    }

    const row = byEmployee.get(record.employee_id)!
    row.total_days++
    if (record.is_compliant) row.compliant_days++
    for (const flag of (record.flags ?? [])) {
      row.flag_counts[flag] = (row.flag_counts[flag] ?? 0) + 1
    }
  }

  for (const row of byEmployee.values()) {
    row.compliance_rate = row.total_days > 0
      ? oneDecimal((row.compliant_days / row.total_days) * 100)
      : 100

    let maxCount = 0
    for (const [flag, count] of Object.entries(row.flag_counts) as [ComplianceFlag, number][]) {
      if (count > maxCount) {
        maxCount = count
        row.most_common_flag = flag
      }
    }
  }

  return Array.from(byEmployee.values())
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))
}

export function transformWfhByDay(schedules: Schedule[]): WfhByDayRow[] {
  const counts: Record<WfhDay, number> = {
    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0,
  }

  for (const s of schedules) {
    const day = DAY_BY_INDEX[getDay(parseISO(s.date))] as WfhDay
    if (day in counts) counts[day]++
  }

  const total = (Object.values(counts) as number[]).reduce((a, b) => a + b, 0)

  return WFH_DAYS
    .map(day => ({
      day,
      wfh_count: counts[day],
      pct_of_total: total > 0 ? oneDecimal((counts[day] / total) * 100) : 0,
    }))
    .sort((a, b) => b.wfh_count - a.wfh_count)
}

export function transformWfhPerEmployee(
  schedules: Schedule[],
  employees: Employee[],
  from: string,
  to: string,
): WfhPerEmpRow[] {
  const days = differenceInDays(parseISO(to), parseISO(from)) + 1
  const weeks = Math.max(1, Math.floor(days / 7))
  const empMap = new Map(employees.map(e => [e.id, e]))
  const wfhCounts = new Map<string, number>()

  for (const s of schedules) {
    const emp = empMap.get(s.employee_id)
    if (!emp || emp.office_days_per_week >= 5) continue
    wfhCounts.set(s.employee_id, (wfhCounts.get(s.employee_id) ?? 0) + 1)
  }

  return Array.from(wfhCounts.entries())
    .map(([empId, wfhDays]) => {
      const emp = empMap.get(empId)!
      const entitlement = (5 - emp.office_days_per_week) * weeks
      return {
        employee_id: empId,
        first_name: emp.first_name,
        last_name: emp.last_name,
        wfh_days: wfhDays,
        total_wfh_entitlement: entitlement,
        utilisation_rate: entitlement > 0
          ? oneDecimal((wfhDays / entitlement) * 100)
          : 0,
      }
    })
    .sort((a, b) => b.wfh_days - a.wfh_days)
}

export function transformMonFriViolations(
  records: ComplianceRecord[],
  employees: Employee[],
): MonFriRow[] {
  const empMap = new Map(employees.map(e => [e.id, e]))
  const byKey = new Map<string, MonFriRow>()

  for (const record of records) {
    const dayIndex = getDay(parseISO(record.date))
    const isMonOrFri = dayIndex === 2 || dayIndex === 6
    if (!isMonOrFri) continue
    if (!(record.flags ?? []).includes('schedule_mismatch')) continue

    const emp = empMap.get(record.employee_id)
    if (!emp) continue

    const month = record.date.substring(0, 7)   // "2026-04"
    const key = `${record.employee_id}__${month}`

    if (!byKey.has(key)) {
      byKey.set(key, {
        employee_id: record.employee_id,
        first_name: emp.first_name,
        last_name: emp.last_name,
        month: format(parseISO(record.date), 'MMMM yyyy'),
        monday_wfh: 0,
        friday_wfh: 0,
        violation_count: 0,
        violation_dates: [],
      })
    }

    const row = byKey.get(key)!
    if (dayIndex === 2) row.monday_wfh++
    if (dayIndex === 6) row.friday_wfh++
    row.violation_count++
    row.violation_dates.push(format(parseISO(record.date), 'MMM d'))
  }

  return Array.from(byKey.values())
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.month.localeCompare(b.month))
}
