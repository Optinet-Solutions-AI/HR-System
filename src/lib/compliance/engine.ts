// Compliance Engine — Core business logic
// Triggered daily by pg_cron calling /api/cron/daily-compliance
// Uses admin client (bypasses RLS) for full data access
//
// Produces one compliance_record per employee per working day.

import {
  parseISO,
  getISOWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isMonday,
  isFriday,
} from 'date-fns'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { isWithinOffice, getOfficeLocations } from '@/lib/compliance/geofence'
import type { OfficeLocation } from '@/lib/compliance/geofence'
import type { TablesInsert } from '@/lib/types/database'
import type {
  Employee,
  Clocking,
  Booking,
  Schedule,
  ComplianceFlag,
  ActualStatus,
  ScheduleStatus,
  ScheduleRule,
} from '@/lib/types/app'

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface ComplianceSummary {
  processed: number
  compliant: number
  flagged: number
  errors: string[]
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/** @internal — exported for testing */
export function getISOWeekNumber(dateStr: string): number {
  return getISOWeek(parseISO(dateStr))
}

/** @internal — exported for testing */
export function isWeekend(dateStr: string): boolean {
  const day = getDay(parseISO(dateStr))
  return day === 0 || day === 6
}

/** @internal — exported for testing. Returns true if within ANY office, false if outside ALL, null if no GPS. */
export function checkLocationAgainstOffices(
  lat: number | null,
  lng: number | null,
  offices: OfficeLocation[]
): boolean | null {
  if (lat == null || lng == null) return null
  for (const office of offices) {
    if (isWithinOffice(lat, lng, office.latitude, office.longitude, office.radius_meters)) {
      return true
    }
  }
  return false
}

/** @internal — exported for testing. Extract Monday/Friday WFH-per-month limits from schedule_rules. */
export function getMondayFridayLimits(rules: ScheduleRule[]): { monday: number; friday: number } {
  let monday = 1
  let friday = 1
  for (const rule of rules) {
    if (rule.rule_type === 'MAX_WFH_PER_DAY_OF_WEEK' && rule.is_active) {
      const val = rule.value as { dayOfWeek?: string; maxPerMonth?: number }
      if (val.dayOfWeek === 'Monday' && val.maxPerMonth != null) monday = val.maxPerMonth
      if (val.dayOfWeek === 'Friday' && val.maxPerMonth != null) friday = val.maxPerMonth
    }
  }
  return { monday, friday }
}

// ---------------------------------------------------------------------
// Per-employee-date processing
// ---------------------------------------------------------------------

/** @internal — exported for testing */
export function processEmployeeDate(
  employee: Employee,
  dateStr: string,
  schedule: Schedule | undefined,
  clocking: Clocking | undefined,
  booking: Booking | undefined,
  isHoliday: boolean,
  offices: OfficeLocation[],
  weeklyWfhCount: number,
  monthlyMondayWfhCount: number,
  monthlyFridayWfhCount: number,
  limits: { monday: number; friday: number }
): TablesInsert<'compliance_records'> {
  const weekNumber = getISOWeekNumber(dateStr)
  const flags: ComplianceFlag[] = []
  let actualStatus: ActualStatus = 'unknown'
  const expectedStatus: ScheduleStatus | null = schedule?.status ?? null
  let hasClocking = false
  const hasBooking = booking != null
  let locationMatch: boolean | null = null
  let comment: string | null = null

  // --- A. No Talexio ID (e.g. Olivier) --------------------------------
  if (employee.talexio_id == null) {
    return {
      employee_id: employee.id,
      date: dateStr,
      week_number: weekNumber,
      expected_status: expectedStatus,
      actual_status: 'unknown',
      has_clocking: false,
      has_booking: hasBooking,
      location_match: null,
      is_compliant: true,
      flags: [],
      comment: 'No Talexio ID — unable to verify attendance',
    }
  }

  // --- B. Public holiday -----------------------------------------------
  if (isHoliday) {
    return {
      employee_id: employee.id,
      date: dateStr,
      week_number: weekNumber,
      expected_status: 'public_holiday',
      actual_status: 'public_holiday',
      has_clocking: clocking != null && clocking.time_in != null,
      has_booking: hasBooking,
      location_match: null,
      is_compliant: true,
      flags: [],
      comment: null,
    }
  }

  // --- C. Vacation / Sick leave ----------------------------------------
  if (expectedStatus === 'vacation' || expectedStatus === 'sick_leave') {
    return {
      employee_id: employee.id,
      date: dateStr,
      week_number: weekNumber,
      expected_status: expectedStatus,
      actual_status: 'vacation',
      has_clocking: clocking != null && clocking.time_in != null,
      has_booking: hasBooking,
      location_match: null,
      is_compliant: true,
      flags: [],
      comment: null,
    }
  }

  // --- D. Determine clocking state -------------------------------------
  const hasTimeIn = clocking != null && clocking.time_in != null
  const hasTimeOut = clocking != null && clocking.time_out != null
  const isBrokenClocking =
    clocking?.clocking_status === 'Broken clocking' || (hasTimeIn && !hasTimeOut)
  hasClocking = hasTimeIn
  locationMatch = hasTimeIn
    ? checkLocationAgainstOffices(clocking!.location_in_lat, clocking!.location_in_lng, offices)
    : null

  // --- E. Status determination based on expected_status ----------------
  if (expectedStatus === 'office') {
    if (!hasTimeIn) {
      actualStatus = 'no_clocking'
      flags.push('missing_clocking')
    } else if (isBrokenClocking) {
      actualStatus = 'broken_clocking'
      flags.push('missing_clock_out', 'clocking_not_closed')
    } else if (locationMatch === true) {
      actualStatus = 'in_office_confirmed'
    } else if (locationMatch === false) {
      actualStatus = 'wrong_location'
      flags.push('wrong_location')
    } else {
      // locationMatch === null — no GPS data, assume office
      actualStatus = 'in_office_confirmed'
    }
    // Additive: no desk booking
    if (!hasBooking) {
      flags.push('no_desk_booking')
    }
  } else if (expectedStatus === 'wfh') {
    if (!hasTimeIn) {
      actualStatus = 'no_clocking'
      flags.push('missing_clocking')
    } else if (isBrokenClocking) {
      actualStatus = 'broken_clocking'
      flags.push('missing_clock_out', 'clocking_not_closed')
    } else if (locationMatch === true) {
      // Came to office on WFH day — NOT a violation
      actualStatus = 'in_office_confirmed'
    } else if (locationMatch === false) {
      actualStatus = 'wfh_confirmed'
    } else {
      // No GPS data
      actualStatus = 'wfh_confirmed'
    }
  } else {
    // No schedule entry (expectedStatus is null or 'not_scheduled')
    if (hasTimeIn && locationMatch === true) {
      actualStatus = 'in_office_confirmed'
    } else if (hasTimeIn) {
      actualStatus = 'unknown'
      comment = 'No schedule entry'
    } else {
      actualStatus = 'unknown'
      comment = 'No schedule entry and no clocking data'
    }
  }

  // --- F. Weekly WFH limit check ---------------------------------------
  const allowedWfhPerWeek = 5 - employee.office_days_per_week
  if (weeklyWfhCount > allowedWfhPerWeek) {
    flags.push('exceeded_wfh_days')
  }

  // --- G. Monthly Monday/Friday check ----------------------------------
  const parsed = parseISO(dateStr)
  if (expectedStatus === 'wfh' && isMonday(parsed) && monthlyMondayWfhCount > limits.monday) {
    flags.push('schedule_mismatch')
  }
  if (expectedStatus === 'wfh' && isFriday(parsed) && monthlyFridayWfhCount > limits.friday) {
    flags.push('schedule_mismatch')
  }

  // --- H. Build record -------------------------------------------------
  const isCompliant = flags.length === 0

  return {
    employee_id: employee.id,
    date: dateStr,
    week_number: weekNumber,
    expected_status: expectedStatus,
    actual_status: actualStatus,
    has_clocking: hasClocking,
    has_booking: hasBooking,
    location_match: locationMatch,
    is_compliant: isCompliant,
    flags,
    comment,
  }
}

// ---------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------

export async function runCompliance(
  from: string,
  to: string
): Promise<ComplianceSummary> {
  const admin = createAdminSupabaseClient()
  const errors: string[] = []

  // --- 1. Parallel data fetch ------------------------------------------
  const extendedFrom = format(startOfMonth(parseISO(from)), 'yyyy-MM-dd')
  const extendedTo = format(endOfMonth(parseISO(to)), 'yyyy-MM-dd')

  const [
    employeesRes,
    holidaysRes,
    schedulesRes,
    clockingsRes,
    bookingsRes,
    rulesRes,
    offices,
  ] = await Promise.all([
    admin.from('employees').select('*').eq('is_active', true),
    admin.from('public_holidays').select('*').gte('date', from).lte('date', to),
    admin.from('schedules').select('*').gte('date', extendedFrom).lte('date', extendedTo),
    admin.from('clockings').select('*').gte('date', from).lte('date', to),
    admin.from('bookings').select('*').gte('date', from).lte('date', to),
    admin.from('schedule_rules').select('*').eq('is_active', true),
    getOfficeLocations(),
  ])

  if (employeesRes.error) throw new Error(`Failed to fetch employees: ${employeesRes.error.message}`)
  if (holidaysRes.error) throw new Error(`Failed to fetch holidays: ${holidaysRes.error.message}`)
  if (schedulesRes.error) throw new Error(`Failed to fetch schedules: ${schedulesRes.error.message}`)
  if (clockingsRes.error) throw new Error(`Failed to fetch clockings: ${clockingsRes.error.message}`)
  if (bookingsRes.error) throw new Error(`Failed to fetch bookings: ${bookingsRes.error.message}`)
  if (rulesRes.error) throw new Error(`Failed to fetch rules: ${rulesRes.error.message}`)

  const employees = employeesRes.data as Employee[]
  const schedules = schedulesRes.data as Schedule[]
  const clockings = clockingsRes.data as Clocking[]
  const bookings = bookingsRes.data as Booking[]
  const rules = rulesRes.data as ScheduleRule[]

  // --- 2. Build lookup maps --------------------------------------------
  const holidaySet = new Set(holidaysRes.data.map((h) => h.date))

  const clockingMap = new Map<string, Clocking>()
  for (const c of clockings) clockingMap.set(`${c.employee_id}:${c.date}`, c)

  const bookingMap = new Map<string, Booking>()
  for (const b of bookings) bookingMap.set(`${b.employee_id}:${b.date}`, b)

  const scheduleMap = new Map<string, Schedule>()
  for (const s of schedules) scheduleMap.set(`${s.employee_id}:${s.date}`, s)

  // Pre-compute weekly WFH counts (key: "employeeId:YYYY-WNN")
  const weeklyWfhCounts = new Map<string, number>()
  for (const s of schedules) {
    if (s.status === 'wfh') {
      const weekKey = `${s.employee_id}:${format(parseISO(s.date), 'yyyy')}-W${String(getISOWeek(parseISO(s.date))).padStart(2, '0')}`
      weeklyWfhCounts.set(weekKey, (weeklyWfhCounts.get(weekKey) ?? 0) + 1)
    }
  }

  // Pre-compute monthly Monday/Friday WFH counts (key: "employeeId:YYYY-MM")
  const monthlyMondayWfh = new Map<string, number>()
  const monthlyFridayWfh = new Map<string, number>()
  for (const s of schedules) {
    if (s.status === 'wfh') {
      const d = parseISO(s.date)
      const monthKey = `${s.employee_id}:${format(d, 'yyyy-MM')}`
      if (isMonday(d)) monthlyMondayWfh.set(monthKey, (monthlyMondayWfh.get(monthKey) ?? 0) + 1)
      if (isFriday(d)) monthlyFridayWfh.set(monthKey, (monthlyFridayWfh.get(monthKey) ?? 0) + 1)
    }
  }

  const limits = getMondayFridayLimits(rules)

  // --- 3. Iterate employees × dates ------------------------------------
  const dateRange = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  })

  const records: TablesInsert<'compliance_records'>[] = []

  for (const date of dateRange) {
    const dateStr = format(date, 'yyyy-MM-dd')

    for (const employee of employees) {
      try {
        const key = `${employee.id}:${dateStr}`
        const schedule = scheduleMap.get(key)

        // Skip weekends unless explicitly scheduled
        if (isWeekend(dateStr) && !schedule) continue

        const clocking = clockingMap.get(key)
        const booking = bookingMap.get(key)
        const holiday = holidaySet.has(dateStr)

        const weekKey = `${employee.id}:${format(date, 'yyyy')}-W${String(getISOWeek(date)).padStart(2, '0')}`
        const wfhCount = weeklyWfhCounts.get(weekKey) ?? 0

        const monthKey = `${employee.id}:${format(date, 'yyyy-MM')}`
        const mondayCount = monthlyMondayWfh.get(monthKey) ?? 0
        const fridayCount = monthlyFridayWfh.get(monthKey) ?? 0

        const record = processEmployeeDate(
          employee,
          dateStr,
          schedule,
          clocking,
          booking,
          holiday,
          offices,
          wfhCount,
          mondayCount,
          fridayCount,
          limits
        )

        records.push(record)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Error processing ${employee.first_name} ${employee.last_name} on ${dateStr}: ${msg}`)
      }
    }
  }

  // --- 4. Batch upsert -------------------------------------------------
  if (records.length > 0) {
    const { error: upsertError } = await admin
      .from('compliance_records')
      .upsert(records, { onConflict: 'employee_id,date' })

    if (upsertError) {
      errors.push(`Upsert failed: ${upsertError.message}`)
    }
  }

  // --- 5. Return summary -----------------------------------------------
  const compliant = records.filter((r) => r.is_compliant).length
  return {
    processed: records.length,
    compliant,
    flagged: records.length - compliant,
    errors,
  }
}
