// src/lib/mock/data.ts
// Generates realistic, date-aware mock data for demo mode.
// All data is deterministic — same results on every page load for a given date.

import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subDays,
  getDay,
  getISOWeek,
  eachDayOfInterval,
  isWeekend,
  subMonths,
  addMonths,
} from 'date-fns'

// ─── Constants ──────────────────────────────────────────────────────────────────

export const DEMO_USER_ID = '00000000-demo-0000-0000-000000000000'
export const DEMO_USER_EMAIL = 'demo@wfh-sentinel.local'

const OFFICE_LAT = 35.9222072
const OFFICE_LNG = 14.4878368

const TEAM_MGMT_ID = '20000000-0000-0000-0000-000000000001'
const TEAM_VIP_ID = '20000000-0000-0000-0000-000000000002'
const TEAM_CONTENT_ID = '20000000-0000-0000-0000-000000000003'
const TEAM_SPORTS_ID = '20000000-0000-0000-0000-000000000004'

// ─── Deterministic hash ─────────────────────────────────────────────────────────
// Used so WFH day assignment, clock times etc. are stable across refreshes.

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

// ─── Employee IDs (deterministic UUIDs) ─────────────────────────────────────────

function empId(n: number): string {
  return `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`
}

// ─── Employees ──────────────────────────────────────────────────────────────────

interface MockEmployee {
  id: string
  auth_user_id: string | null
  talexio_id: string | null
  first_name: string
  last_name: string
  email: string
  job_schedule: string | null
  unit: string | null
  business_unit: string | null
  office_days_per_week: number
  role: 'employee' | 'manager' | 'hr_admin' | 'super_admin'
  team_id: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

const NOW_ISO = new Date().toISOString()

export const MOCK_EMPLOYEES: MockEmployee[] = [
  // ── 5 office days ───────────────────────────────────────────────────────────
  {
    id: empId(1), auth_user_id: DEMO_USER_ID, talexio_id: 'Niwi01',
    first_name: 'Niklas', last_name: 'Wirth',
    email: 'niklas.wirth@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    office_days_per_week: 5, role: 'hr_admin', team_id: TEAM_MGMT_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(2), auth_user_id: null, talexio_id: 'Moal01',
    first_name: 'Mohamed', last_name: 'AlJebali',
    email: 'mohamed.aljebali@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    office_days_per_week: 5, role: 'employee', team_id: TEAM_CONTENT_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(3), auth_user_id: null, talexio_id: 'Yari01',
    first_name: 'Yassine', last_name: 'Ridene',
    email: 'yassine.ridene@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    office_days_per_week: 5, role: 'employee', team_id: TEAM_SPORTS_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(4), auth_user_id: null, talexio_id: 'Yoay01',
    first_name: 'Youssef', last_name: 'Ayedi',
    email: 'youssef.ayedi@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    office_days_per_week: 5, role: 'employee', team_id: TEAM_SPORTS_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(5), auth_user_id: null, talexio_id: 'Esri01',
    first_name: 'Esam', last_name: 'Ridene',
    email: 'esam.ridene@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Sports', business_unit: 'Sports',
    office_days_per_week: 5, role: 'employee', team_id: TEAM_SPORTS_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  // ── 4 office days ───────────────────────────────────────────────────────────
  {
    id: empId(6), auth_user_id: null, talexio_id: 'Adsu01',
    first_name: 'Ada', last_name: 'Svardal',
    email: 'ada.svardal@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    office_days_per_week: 4, role: 'employee', team_id: TEAM_VIP_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(7), auth_user_id: null, talexio_id: 'Jasa01',
    first_name: 'Janice', last_name: 'Santangelo',
    email: 'janice.santangelo@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    office_days_per_week: 4, role: 'manager', team_id: TEAM_VIP_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(8), auth_user_id: null, talexio_id: 'Owor01',
    first_name: 'Owen', last_name: 'Ordway',
    email: 'owen.ordway@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    office_days_per_week: 4, role: 'employee', team_id: TEAM_VIP_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(9), auth_user_id: null, talexio_id: 'Rewh01',
    first_name: 'Redvers', last_name: 'Whitehead',
    email: 'redvers.whitehead@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    office_days_per_week: 4, role: 'employee', team_id: TEAM_VIP_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(10), auth_user_id: null, talexio_id: 'Sado01',
    first_name: 'Salvatore', last_name: 'Dolce',
    email: 'salvatore.dolce@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    office_days_per_week: 4, role: 'employee', team_id: TEAM_MGMT_ID,
    is_active: true, notes: 'Not sure when/if he will come to office — Alex is aware',
    created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(11), auth_user_id: null, talexio_id: 'Tiko01',
    first_name: 'Tina', last_name: 'Koepf',
    email: 'tina.koepf@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    office_days_per_week: 4, role: 'employee', team_id: TEAM_CONTENT_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  // ── 2 office days ───────────────────────────────────────────────────────────
  {
    id: empId(12), auth_user_id: null, talexio_id: 'Daza01',
    first_name: 'Darren', last_name: 'Zahra',
    email: 'darren.zahra@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'VIP Team JS', business_unit: 'Sports',
    office_days_per_week: 2, role: 'employee', team_id: TEAM_VIP_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  {
    id: empId(13), auth_user_id: null, talexio_id: 'Alza01',
    first_name: 'Alec', last_name: 'Zanussi',
    email: 'alec.zanussi@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Content', business_unit: 'Content',
    office_days_per_week: 2, role: 'employee', team_id: TEAM_CONTENT_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  // ── 1 office day ────────────────────────────────────────────────────────────
  {
    id: empId(14), auth_user_id: null, talexio_id: 'Chde01',
    first_name: 'Christian', last_name: 'Deeken',
    email: 'christian.deeken@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: 'Management', business_unit: 'Operations',
    office_days_per_week: 1, role: 'employee', team_id: TEAM_MGMT_ID,
    is_active: true, notes: null, created_at: NOW_ISO, updated_at: NOW_ISO,
  },
  // ── Inactive ────────────────────────────────────────────────────────────────
  {
    id: empId(15), auth_user_id: null, talexio_id: null,
    first_name: 'Olivier', last_name: 'Martin',
    email: 'olivier.martin@company.mt',
    job_schedule: 'Full Time 40Hrs', unit: null, business_unit: null,
    office_days_per_week: 4, role: 'employee', team_id: null,
    is_active: false, notes: 'No clocking/booking data. May be inactive.',
    created_at: NOW_ISO, updated_at: NOW_ISO,
  },
]

// ─── Teams ──────────────────────────────────────────────────────────────────────

export const MOCK_TEAMS = [
  { id: TEAM_MGMT_ID, name: 'Management', manager_id: empId(1), created_at: NOW_ISO },
  { id: TEAM_VIP_ID, name: 'VIP Team JS', manager_id: empId(7), created_at: NOW_ISO },
  { id: TEAM_CONTENT_ID, name: 'Content', manager_id: empId(2), created_at: NOW_ISO },
  { id: TEAM_SPORTS_ID, name: 'Sports', manager_id: empId(3), created_at: NOW_ISO },
]

// ─── Schedule Rules ─────────────────────────────────────────────────────────────

export const MOCK_SCHEDULE_RULES = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    name: 'Max WFH per day',
    rule_type: 'MAX_WFH_PER_DAY',
    value: { maxCount: 5 },
    applies_to_team_id: null,
    is_active: true,
    created_at: NOW_ISO,
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    name: 'Monday WFH limit',
    rule_type: 'MAX_WFH_PER_DAY_OF_WEEK',
    value: { dayOfWeek: 'Monday', maxPerMonth: 1 },
    applies_to_team_id: null,
    is_active: true,
    created_at: NOW_ISO,
  },
  {
    id: '30000000-0000-0000-0000-000000000003',
    name: 'Friday WFH limit',
    rule_type: 'MAX_WFH_PER_DAY_OF_WEEK',
    value: { dayOfWeek: 'Friday', maxPerMonth: 1 },
    applies_to_team_id: null,
    is_active: true,
    created_at: NOW_ISO,
  },
]

// ─── Office Locations ───────────────────────────────────────────────────────────

export const MOCK_OFFICE_LOCATIONS = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    name: 'Head Office',
    latitude: OFFICE_LAT,
    longitude: OFFICE_LNG,
    radius_meters: 200,
    ip_ranges: [],
    is_active: true,
    created_at: NOW_ISO,
  },
]

// ─── Public Holidays (Malta 2026) ───────────────────────────────────────────────

export const MOCK_PUBLIC_HOLIDAYS = [
  { id: '50000000-0000-0000-0000-000000000001', date: '2026-01-01', name: "New Year's Day", created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000002', date: '2026-02-10', name: "Feast of St. Paul's Shipwreck", created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000003', date: '2026-03-19', name: 'Feast of St. Joseph', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000004', date: '2026-03-31', name: 'Freedom Day', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000005', date: '2026-04-03', name: 'Good Friday', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000006', date: '2026-05-01', name: "Worker's Day", created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000007', date: '2026-06-07', name: 'Sette Giugno', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000008', date: '2026-06-29', name: 'Feast of St. Peter & St. Paul', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-000000000009', date: '2026-08-15', name: 'Feast of the Assumption', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-00000000000a', date: '2026-09-08', name: 'Our Lady of Victories', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-00000000000b', date: '2026-09-21', name: 'Independence Day', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-00000000000c', date: '2026-12-08', name: 'Feast of the Immaculate Conception', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-00000000000d', date: '2026-12-13', name: 'Republic Day', created_at: NOW_ISO },
  { id: '50000000-0000-0000-0000-00000000000e', date: '2026-12-25', name: 'Christmas Day', created_at: NOW_ISO },
]

// ─── Schedule Locks ─────────────────────────────────────────────────────────────

export const MOCK_SCHEDULE_LOCKS: unknown[] = []

// ─── Dynamic Data Generators ────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const holidaySet = new Set(MOCK_PUBLIC_HOLIDAYS.map(h => h.date))

function isHoliday(dateStr: string): boolean {
  return holidaySet.has(dateStr)
}

// Assign each 4-office-day employee a preferred WFH weekday (1=Mon..5=Fri)
// Deterministic per employee, avoids Monday/Friday to respect the rule.
const WFH_WEEKDAY_PREFERENCE: Record<string, number[]> = {
  [empId(6)]:  [3],          // Ada → Wednesday
  [empId(7)]:  [2],          // Janice → Tuesday
  [empId(8)]:  [4],          // Owen → Thursday
  [empId(9)]:  [3],          // Redvers → Wednesday
  [empId(10)]: [4],          // Salvo → Thursday
  [empId(11)]: [2],          // Tina → Tuesday
  // 2-office-day employees: 3 WFH days per week
  [empId(12)]: [1, 3, 5],    // Darren → Mon, Wed, Fri (demonstrates Mon/Fri rule)
  [empId(13)]: [2, 3, 4],    // Alec → Tue, Wed, Thu
  // 1-office-day employee: 4 WFH days per week (office on Tuesday)
  [empId(14)]: [1, 3, 4, 5], // Christian → Mon, Wed, Thu, Fri
}

/**
 * Generates schedules for a date range (typically current month +/- 1 month).
 * Each working day gets a schedule entry for every active employee.
 */
export function generateSchedules(fromDate: string, toDate: string) {
  const schedules: Array<{
    id: string
    employee_id: string
    date: string
    status: string
    approved_by: string | null
    approved_at: string | null
    created_at: string
    updated_at: string
  }> = []

  const activeEmployees = MOCK_EMPLOYEES.filter(e => e.is_active)
  const days = eachDayOfInterval({ start: parseISO(fromDate), end: parseISO(toDate) })

  // Track Monday/Friday WFH counts per employee per month for the limit rule
  const monFriCounts: Record<string, Record<string, { mon: number; fri: number }>> = {}

  for (const day of days) {
    if (isWeekend(day)) continue
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isHoliday(dateStr)) continue

    const dayOfWeek = getDay(day) // 0=Sun, 1=Mon ... 5=Fri

    // Check if Darren has vacation (give him 1 vacation day: first Thursday in range that's > 7 days ago)
    const daysAgo = Math.floor((Date.now() - day.getTime()) / (1000 * 60 * 60 * 24))
    const isDarrenVacation = dayOfWeek === 4 && daysAgo >= 3 && daysAgo <= 9

    for (const emp of activeEmployees) {
      const schedId = `60000000-${dateStr.replace(/-/g, '')}-${emp.id.slice(-4)}`
      let status: string

      if (emp.id === empId(12) && isDarrenVacation) {
        status = 'vacation'
      } else if (emp.office_days_per_week >= 5) {
        status = 'office'
      } else {
        const wfhDays = WFH_WEEKDAY_PREFERENCE[emp.id]
        if (wfhDays && wfhDays.includes(dayOfWeek)) {
          // Check Monday/Friday limit: max 1 per month
          const monthKey = dateStr.substring(0, 7)
          if (!monFriCounts[emp.id]) monFriCounts[emp.id] = {}
          if (!monFriCounts[emp.id][monthKey]) monFriCounts[emp.id][monthKey] = { mon: 0, fri: 0 }
          const counts = monFriCounts[emp.id][monthKey]

          if (dayOfWeek === 1) {
            if (counts.mon < 1) {
              status = 'wfh'
              counts.mon++
            } else {
              status = 'office'
            }
          } else if (dayOfWeek === 5) {
            if (counts.fri < 1) {
              status = 'wfh'
              counts.fri++
            } else {
              status = 'office'
            }
          } else {
            status = 'wfh'
          }
        } else {
          status = 'office'
        }
      }

      schedules.push({
        id: schedId,
        employee_id: emp.id,
        date: dateStr,
        status,
        approved_by: null,
        approved_at: null,
        created_at: NOW_ISO,
        updated_at: NOW_ISO,
      })
    }
  }

  return schedules
}

/**
 * Generates clockings for a date range.
 * Preserves edge cases: Niklas (no clocking), Redvers (wrong GPS), Tina (broken clocking).
 */
export function generateClockings(fromDate: string, toDate: string, schedules: ReturnType<typeof generateSchedules>) {
  const clockings: Array<{
    id: string
    employee_id: string
    date: string
    day_of_week: string
    time_in: string | null
    time_out: string | null
    hours_worked: number | null
    location_in_name: string | null
    location_in_lat: number | null
    location_in_lng: number | null
    location_out_name: string | null
    location_out_lat: number | null
    location_out_lng: number | null
    clocking_status: string | null
    synced_at: string
  }> = []

  const scheduleMap = new Map<string, string>()
  for (const s of schedules) {
    scheduleMap.set(`${s.employee_id}__${s.date}`, s.status)
  }

  const days = eachDayOfInterval({ start: parseISO(fromDate), end: parseISO(toDate) })
  const activeEmployees = MOCK_EMPLOYEES.filter(e => e.is_active)

  for (const day of days) {
    if (isWeekend(day)) continue
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isHoliday(dateStr)) continue

    for (const emp of activeEmployees) {
      const status = scheduleMap.get(`${emp.id}__${dateStr}`)
      if (!status || status === 'vacation' || status === 'sick_leave' || status === 'public_holiday') continue

      const clockId = `70000000-${dateStr.replace(/-/g, '')}-${emp.id.slice(-4)}`
      const dayName = DAY_NAMES[getDay(day)]

      // Vary clock times deterministically
      const h = hash(dateStr + emp.id)
      const minuteOffset = h % 20 // 0-19 minutes offset
      const clockInHour = 8 + Math.floor(minuteOffset / 20)
      const clockInMin = 30 + (minuteOffset % 30)
      const timeIn = `${String(clockInHour).padStart(2, '0')}:${String(clockInMin).padStart(2, '0')}`
      const timeOutHour = clockInHour + 8 + Math.floor((h % 7) / 3)
      const timeOutMin = clockInMin + (h % 15)
      const timeOut = `${String(timeOutHour).padStart(2, '0')}:${String(timeOutMin > 59 ? 0 : timeOutMin).padStart(2, '0')}`

      // ── Niklas: no clocking ──────────────────────────────────────────────
      if (emp.id === empId(1)) {
        clockings.push({
          id: clockId, employee_id: emp.id, date: dateStr, day_of_week: dayName,
          time_in: null, time_out: null, hours_worked: null,
          location_in_name: null, location_in_lat: null, location_in_lng: null,
          location_out_name: null, location_out_lat: null, location_out_lng: null,
          clocking_status: 'Active Clocking', synced_at: NOW_ISO,
        })
        continue
      }

      // ── Redvers: wrong GPS on office days ────────────────────────────────
      if (emp.id === empId(9) && status === 'office') {
        clockings.push({
          id: clockId, employee_id: emp.id, date: dateStr, day_of_week: dayName,
          time_in: '09:10', time_out: '18:10', hours_worked: 8.42,
          location_in_name: null, location_in_lat: 35.88758842, location_in_lng: 14.48299381,
          location_out_name: null, location_out_lat: 35.88758842, location_out_lng: 14.48299381,
          clocking_status: 'Active Clocking', synced_at: NOW_ISO,
        })
        continue
      }

      // ── Tina: broken clocking on office days ─────────────────────────────
      if (emp.id === empId(11) && status === 'office') {
        clockings.push({
          id: clockId, employee_id: emp.id, date: dateStr, day_of_week: dayName,
          time_in: '09:05', time_out: null, hours_worked: null,
          location_in_name: null, location_in_lat: 35.9145984, location_in_lng: 14.4935334,
          location_out_name: null, location_out_lat: null, location_out_lng: null,
          clocking_status: 'Broken clocking', synced_at: NOW_ISO,
        })
        continue
      }

      // ── WFH employees: home GPS ──────────────────────────────────────────
      if (status === 'wfh') {
        const homeLat = 35.84 + (h % 8) * 0.01
        const homeLng = 14.50 + (h % 5) * 0.01
        clockings.push({
          id: clockId, employee_id: emp.id, date: dateStr, day_of_week: dayName,
          time_in: timeIn, time_out: timeOut, hours_worked: 8.25 + (h % 10) * 0.05,
          location_in_name: 'Home', location_in_lat: homeLat, location_in_lng: homeLng,
          location_out_name: 'Home', location_out_lat: homeLat, location_out_lng: homeLng,
          clocking_status: 'Active Clocking', synced_at: NOW_ISO,
        })
        continue
      }

      // ── Normal office clocking ───────────────────────────────────────────
      clockings.push({
        id: clockId, employee_id: emp.id, date: dateStr, day_of_week: dayName,
        time_in: timeIn, time_out: timeOut, hours_worked: 8.5 + (h % 6) * 0.05,
        location_in_name: 'Head Office', location_in_lat: OFFICE_LAT, location_in_lng: OFFICE_LNG,
        location_out_name: 'Head Office', location_out_lat: OFFICE_LAT, location_out_lng: OFFICE_LNG,
        clocking_status: 'Active Clocking', synced_at: NOW_ISO,
      })
    }
  }

  return clockings
}

/**
 * Generates compliance records from schedules and clockings.
 */
export function generateComplianceRecords(
  fromDate: string,
  toDate: string,
  schedules: ReturnType<typeof generateSchedules>,
  clockings: ReturnType<typeof generateClockings>,
) {
  const records: Array<{
    id: string
    employee_id: string
    date: string
    week_number: number
    expected_status: string | null
    actual_status: string
    has_clocking: boolean
    has_booking: boolean
    location_match: boolean | null
    is_compliant: boolean
    flags: string[] | null
    comment: string | null
    reviewed_by: string | null
    reviewed_at: string | null
    override_reason: string | null
    created_at: string
  }> = []

  const clockingMap = new Map<string, (typeof clockings)[number]>()
  for (const c of clockings) {
    clockingMap.set(`${c.employee_id}__${c.date}`, c)
  }

  const scheduleMap = new Map<string, string>()
  for (const s of schedules) {
    scheduleMap.set(`${s.employee_id}__${s.date}`, s.status)
  }

  const days = eachDayOfInterval({ start: parseISO(fromDate), end: parseISO(toDate) })
  const activeEmployees = MOCK_EMPLOYEES.filter(e => e.is_active)

  for (const day of days) {
    if (isWeekend(day)) continue
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isHoliday(dateStr)) continue

    const weekNumber = getISOWeek(day)

    for (const emp of activeEmployees) {
      const expectedStatus = scheduleMap.get(`${emp.id}__${dateStr}`) ?? null
      if (expectedStatus === 'vacation') {
        records.push({
          id: `80000000-${dateStr.replace(/-/g, '')}-${emp.id.slice(-4)}`,
          employee_id: emp.id, date: dateStr, week_number: weekNumber,
          expected_status: 'vacation', actual_status: 'vacation',
          has_clocking: false, has_booking: false, location_match: null,
          is_compliant: true, flags: [], comment: null,
          reviewed_by: null, reviewed_at: null, override_reason: null,
          created_at: NOW_ISO,
        })
        continue
      }

      const clocking = clockingMap.get(`${emp.id}__${dateStr}`)
      const hasClocking = !!(clocking?.time_in)
      const h = hash(dateStr + emp.id)

      let actualStatus: string
      let flags: string[] = []
      let isCompliant = true
      let locationMatch: boolean | null = null
      let hasBooking = false

      // ── Niklas: no clocking ────────────────────────────────────────────
      if (emp.id === empId(1)) {
        actualStatus = 'no_clocking'
        flags = ['missing_clocking']
        isCompliant = false
      }
      // ── Redvers: wrong location on office days ─────────────────────────
      else if (emp.id === empId(9) && expectedStatus === 'office') {
        actualStatus = 'wrong_location'
        flags = ['wrong_location']
        isCompliant = false
        locationMatch = false
        hasBooking = true
      }
      // ── Tina: broken clocking on office days ───────────────────────────
      else if (emp.id === empId(11) && expectedStatus === 'office') {
        actualStatus = 'broken_clocking'
        flags = ['missing_clock_out', 'clocking_not_closed']
        isCompliant = false
        locationMatch = false
      }
      // ── WFH day with clocking from home ────────────────────────────────
      else if (expectedStatus === 'wfh') {
        actualStatus = 'wfh_confirmed'
        isCompliant = true
        hasBooking = false
      }
      // ── Normal office day ──────────────────────────────────────────────
      else {
        actualStatus = 'in_office_confirmed'
        locationMatch = true
        // Most employees have bookings, but skip one occasionally for variety
        hasBooking = h % 7 !== 0
        if (!hasBooking) {
          flags = ['no_desk_booking']
          // no_desk_booking is a minor flag, still compliant
        }
      }

      records.push({
        id: `80000000-${dateStr.replace(/-/g, '')}-${emp.id.slice(-4)}`,
        employee_id: emp.id, date: dateStr, week_number: weekNumber,
        expected_status: expectedStatus, actual_status: actualStatus,
        has_clocking: hasClocking, has_booking: hasBooking, location_match: locationMatch,
        is_compliant: isCompliant, flags: flags.length > 0 ? flags : [],
        comment: null, reviewed_by: null, reviewed_at: null, override_reason: null,
        created_at: NOW_ISO,
      })
    }
  }

  return records
}

/**
 * Generates bookings for office-day employees who have clockings.
 */
export function generateBookings(
  fromDate: string,
  toDate: string,
  schedules: ReturnType<typeof generateSchedules>,
  clockings: ReturnType<typeof generateClockings>,
) {
  const bookings: Array<{
    id: string
    employee_id: string
    date: string
    status: string
    room: string | null
    time_from: string | null
    time_to: string | null
    duration: string | null
    date_booked: string | null
    work_location: string | null
    synced_at: string
  }> = []

  const rooms = ['GCC 2', 'Main 5', 'Open Plan', 'Meeting Room A', 'Hot Desk 3']
  const clockingSet = new Set(clockings.filter(c => c.time_in).map(c => `${c.employee_id}__${c.date}`))

  for (const sched of schedules) {
    if (sched.status !== 'office') continue
    if (!clockingSet.has(`${sched.employee_id}__${sched.date}`)) continue

    const h = hash(sched.date + sched.employee_id)
    // Skip some bookings to create no_desk_booking scenarios
    if (h % 7 === 0) continue

    bookings.push({
      id: `90000000-${sched.date.replace(/-/g, '')}-${sched.employee_id.slice(-4)}`,
      employee_id: sched.employee_id,
      date: sched.date,
      status: 'Office',
      room: rooms[h % rooms.length],
      time_from: '09:00',
      time_to: '18:00',
      duration: '9h',
      date_booked: NOW_ISO,
      work_location: 'Head Office',
      synced_at: NOW_ISO,
    })
  }

  return bookings
}

// ─── Cached generated data ──────────────────────────────────────────────────────
// Generate once and cache. Covers current month +/- 1 month for calendars,
// and past 2 weeks for clockings/compliance.

let _cache: {
  schedules: ReturnType<typeof generateSchedules>
  clockings: ReturnType<typeof generateClockings>
  complianceRecords: ReturnType<typeof generateComplianceRecords>
  bookings: ReturnType<typeof generateBookings>
} | null = null

function getGeneratedData() {
  if (_cache) return _cache

  const today = new Date()
  // Schedules: cover prev month through next month
  const schedFrom = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const schedTo = format(endOfMonth(addMonths(today, 1)), 'yyyy-MM-dd')

  // Clockings & compliance: past 14 days through today
  const clockFrom = format(subDays(today, 14), 'yyyy-MM-dd')
  const clockTo = format(today, 'yyyy-MM-dd')

  const schedules = generateSchedules(schedFrom, schedTo)
  const clockings = generateClockings(clockFrom, clockTo, schedules)
  const complianceRecords = generateComplianceRecords(clockFrom, clockTo, schedules, clockings)
  const bookings = generateBookings(clockFrom, clockTo, schedules, clockings)

  _cache = { schedules, clockings, complianceRecords, bookings }
  return _cache
}

// ─── Public API: get all data for a table ───────────────────────────────────────

export function getTableData(table: string): unknown[] {
  const generated = getGeneratedData()

  switch (table) {
    case 'employees':
      return MOCK_EMPLOYEES
    case 'teams':
      return MOCK_TEAMS
    case 'schedules':
      return generated.schedules
    case 'clockings':
      return generated.clockings
    case 'compliance_records':
      return generated.complianceRecords
    case 'bookings':
      return generated.bookings
    case 'schedule_rules':
      return MOCK_SCHEDULE_RULES
    case 'office_locations':
      return MOCK_OFFICE_LOCATIONS
    case 'public_holidays':
      return MOCK_PUBLIC_HOLIDAYS
    case 'schedule_locks':
      return MOCK_SCHEDULE_LOCKS
    default:
      return []
  }
}
