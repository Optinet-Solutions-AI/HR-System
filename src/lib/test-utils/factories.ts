// Test data factories for Vitest tests
// Provides type-safe factory functions with sensible defaults.
// Each factory accepts Partial<T> overrides.

import type {
  Employee,
  Clocking,
  Booking,
  Schedule,
  ScheduleRule,
  OfficeLocation,
  PublicHoliday,
} from '@/lib/types/app'

// ---------------------------------------------------------------------------
// GPS Constants
// ---------------------------------------------------------------------------

export const OFFICE_GPS = { lat: 35.9222072, lng: 14.4878368 } as const
export const REDVERS_WRONG_GPS = { lat: 35.887, lng: 14.482 } as const // ~3.8km from office
export const TINA_NEAR_GPS = { lat: 35.914, lng: 14.493 } as const // ~900m from office
export const FAR_AWAY_GPS = { lat: 36.0, lng: 14.3 } as const // clearly outside any radius

// ---------------------------------------------------------------------------
// Factory: Employee
// ---------------------------------------------------------------------------

let employeeCounter = 0

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  employeeCounter++
  return {
    id: `emp-${employeeCounter}`,
    auth_user_id: null,
    talexio_id: `Test${String(employeeCounter).padStart(2, '0')}`,
    first_name: 'Alice',
    last_name: 'Smith',
    email: `alice${employeeCounter}@test.com`,
    job_schedule: 'Full Time 40Hrs',
    unit: null,
    business_unit: null,
    office_days_per_week: 4,
    role: 'employee',
    team_id: null,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Named Employee Presets (matching real data from CLAUDE.md)
// ---------------------------------------------------------------------------

export const NIKLAS = makeEmployee({
  id: 'emp-niklas',
  talexio_id: 'Niwi01',
  first_name: 'Niklas',
  last_name: 'Wirth',
  email: 'niklas@test.com',
  office_days_per_week: 5,
})

export const CHRISTIAN = makeEmployee({
  id: 'emp-christian',
  talexio_id: 'Chde01',
  first_name: 'Christian',
  last_name: 'Deeken',
  email: 'christian@test.com',
  office_days_per_week: 1,
})

export const DARREN = makeEmployee({
  id: 'emp-darren',
  talexio_id: 'Daza01',
  first_name: 'Darren',
  last_name: 'Zahra',
  email: 'darren@test.com',
  office_days_per_week: 2,
})

export const ALEC = makeEmployee({
  id: 'emp-alec',
  talexio_id: 'Alza01',
  first_name: 'Alec',
  last_name: 'Zanussi',
  email: 'alec@test.com',
  office_days_per_week: 2,
})

export const REDVERS = makeEmployee({
  id: 'emp-redvers',
  talexio_id: 'Rewh01',
  first_name: 'Redvers',
  last_name: 'Whitehead',
  email: 'redvers@test.com',
  office_days_per_week: 4,
})

export const TINA = makeEmployee({
  id: 'emp-tina',
  talexio_id: 'Tiko01',
  first_name: 'Tina',
  last_name: 'Koepf',
  email: 'tina@test.com',
  office_days_per_week: 4,
})

export const OLIVIER = makeEmployee({
  id: 'emp-olivier',
  talexio_id: null,
  first_name: 'Olivier',
  last_name: 'Olivier',
  email: 'olivier@test.com',
  office_days_per_week: 4,
})

export const SALVO = makeEmployee({
  id: 'emp-salvo',
  talexio_id: 'Sado01',
  first_name: 'Salvatore',
  last_name: 'Dolce',
  email: 'salvo@test.com',
  office_days_per_week: 4,
  notes: 'Not sure when/if he will come to office — Alex is aware',
})

// ---------------------------------------------------------------------------
// Factory: Clocking
// ---------------------------------------------------------------------------

export function makeClocking(overrides: Partial<Clocking> = {}): Clocking {
  return {
    id: 'clk-1',
    employee_id: 'emp-1',
    date: '2026-04-07',
    day_of_week: 'Tuesday',
    time_in: '09:00',
    time_out: '18:00',
    hours_worked: 8.5,
    location_in_name: 'Head Office',
    location_in_lat: OFFICE_GPS.lat,
    location_in_lng: OFFICE_GPS.lng,
    location_out_name: 'Head Office',
    location_out_lat: OFFICE_GPS.lat,
    location_out_lng: OFFICE_GPS.lng,
    clocking_status: 'Active Clocking',
    synced_at: '2026-04-07T18:30:00Z',
    ...overrides,
  }
}

/** Convenience: a clocking with no punch-out (broken clocking). */
export function makeBrokenClocking(overrides: Partial<Clocking> = {}): Clocking {
  return makeClocking({
    time_out: null,
    hours_worked: null,
    clocking_status: 'Broken clocking',
    location_out_name: null,
    location_out_lat: null,
    location_out_lng: null,
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Factory: Booking
// ---------------------------------------------------------------------------

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bkng-1',
    employee_id: 'emp-1',
    date: '2026-04-07',
    status: 'Office',
    room: 'GCC 2',
    time_from: '09:00',
    time_to: '18:00',
    duration: '9h',
    date_booked: '2026-04-01T10:00:00Z',
    work_location: 'Head Office',
    synced_at: '2026-04-07T07:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory: Schedule
// ---------------------------------------------------------------------------

export function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sch-1',
    employee_id: 'emp-1',
    date: '2026-04-07',
    status: 'office',
    approved_by: null,
    approved_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory: ScheduleRule
// ---------------------------------------------------------------------------

export function makeScheduleRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    name: 'Max WFH Monday',
    rule_type: 'MAX_WFH_PER_DAY_OF_WEEK',
    value: { dayOfWeek: 'Monday', maxPerMonth: 1 },
    applies_to_team_id: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory: OfficeLocation
// ---------------------------------------------------------------------------

export function makeOfficeLocation(overrides: Partial<OfficeLocation> = {}): OfficeLocation {
  return {
    id: 'loc-1',
    name: 'Head Office',
    latitude: OFFICE_GPS.lat,
    longitude: OFFICE_GPS.lng,
    radius_meters: 200,
    ip_ranges: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory: PublicHoliday
// ---------------------------------------------------------------------------

export function makePublicHoliday(overrides: Partial<PublicHoliday> = {}): PublicHoliday {
  return {
    id: 'hol-1',
    date: '2026-04-03',
    name: 'Good Friday',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
