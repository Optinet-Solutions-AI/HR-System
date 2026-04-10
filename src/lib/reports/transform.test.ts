import { describe, it, expect } from 'vitest'
import {
  transformAttendance,
  transformWfhByDay,
  transformWfhPerEmployee,
  transformMonFriViolations,
} from './transform'
import type { ComplianceRecord, Employee, Schedule } from '@/lib/types/app'

// ─── Factories ────────────────────────────────────────────────────────────────

function rec(overrides: Partial<ComplianceRecord> = {}): ComplianceRecord {
  return {
    id: 'rec-1',
    employee_id: 'emp-1',
    date: '2026-04-07',      // Monday
    week_number: 15,
    expected_status: 'office',
    actual_status: 'in_office_confirmed',
    has_clocking: true,
    has_booking: true,
    location_match: true,
    is_compliant: true,
    flags: [],
    comment: null,
    reviewed_by: null,
    reviewed_at: null,
    override_reason: null,
    created_at: '2026-04-07T10:00:00Z',
    ...overrides,
  } as ComplianceRecord
}

function emp(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    auth_user_id: null,
    talexio_id: 'Test01',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@test.com',
    office_days_per_week: 4,
    role: 'employee',
    team_id: null,
    is_active: true,
    notes: null,
    job_schedule: null,
    unit: null,
    business_unit: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Employee
}

function sch(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sch-1',
    employee_id: 'emp-1',
    date: '2026-04-07',      // Monday
    status: 'wfh',
    approved_by: null,
    approved_at: null,
    created_at: '2026-04-07T10:00:00Z',
    updated_at: '2026-04-07T10:00:00Z',
    ...overrides,
  } as Schedule
}

// ─── transformAttendance ──────────────────────────────────────────────────────

describe('transformAttendance', () => {
  it('returns one row per employee', () => {
    const records = [
      rec({ employee_id: 'emp-1' }),
      rec({ id: 'rec-2', employee_id: 'emp-2' }),
    ]
    const employees = [
      emp({ id: 'emp-1' }),
      emp({ id: 'emp-2', first_name: 'Bob', last_name: 'Jones' }),
    ]
    expect(transformAttendance(records, employees)).toHaveLength(2)
  })

  it('computes compliance_rate to one decimal place', () => {
    const records = [
      rec({ id: 'r1', is_compliant: true }),
      rec({ id: 'r2', is_compliant: false, flags: ['missing_clocking'] }),
      rec({ id: 'r3', is_compliant: false, flags: ['missing_clocking'] }),
    ]
    const [row] = transformAttendance(records, [emp()])
    expect(row.total_days).toBe(3)
    expect(row.compliant_days).toBe(1)
    expect(row.compliance_rate).toBe(33.3)
  })

  it('identifies the most_common_flag', () => {
    const records = [
      rec({ id: 'r1', is_compliant: false, flags: ['missing_clocking'] }),
      rec({ id: 'r2', is_compliant: false, flags: ['missing_clocking', 'wrong_location'] }),
    ]
    const [row] = transformAttendance(records, [emp()])
    expect(row.most_common_flag).toBe('missing_clocking')
    expect(row.flag_counts.missing_clocking).toBe(2)
    expect(row.flag_counts.wrong_location).toBe(1)
  })

  it('returns most_common_flag null when no flags', () => {
    const [row] = transformAttendance([rec({ is_compliant: true, flags: [] })], [emp()])
    expect(row.most_common_flag).toBeNull()
  })

  it('skips records whose employee_id is not in the employees list', () => {
    const result = transformAttendance([rec({ employee_id: 'unknown' })], [emp({ id: 'emp-1' })])
    expect(result).toHaveLength(0)
  })

  it('sorts output by last_name ascending', () => {
    const records = [
      rec({ id: 'r1', employee_id: 'emp-2' }),
      rec({ id: 'r2', employee_id: 'emp-1' }),
    ]
    const employees = [
      emp({ id: 'emp-1', last_name: 'Zeta' }),
      emp({ id: 'emp-2', last_name: 'Alpha' }),
    ]
    const rows = transformAttendance(records, employees)
    expect(rows[0].last_name).toBe('Alpha')
    expect(rows[1].last_name).toBe('Zeta')
  })
})

// ─── transformWfhByDay ────────────────────────────────────────────────────────

describe('transformWfhByDay', () => {
  it('always returns all 5 weekdays', () => {
    const rows = transformWfhByDay([sch({ date: '2026-04-07' })]) // Monday only
    expect(rows).toHaveLength(5)
    const days = rows.map(r => r.day)
    expect(days).toContain('Tuesday')
    expect(days).toContain('Wednesday')
  })

  it('counts WFH days per weekday', () => {
    const schedules = [
      sch({ date: '2026-04-07' }),  // Monday
      sch({ id: 'sch-2', employee_id: 'emp-2', date: '2026-04-07' }), // Monday
      sch({ id: 'sch-3', date: '2026-04-11' }),  // Friday
    ]
    const rows = transformWfhByDay(schedules)
    expect(rows.find(r => r.day === 'Monday')!.wfh_count).toBe(2)
    expect(rows.find(r => r.day === 'Friday')!.wfh_count).toBe(1)
  })

  it('computes pct_of_total (Monday = 1 of 2 total = 50%)', () => {
    const schedules = [
      sch({ date: '2026-04-07' }),  // Monday
      sch({ id: 'sch-2', date: '2026-04-08' }),  // Tuesday
    ]
    const rows = transformWfhByDay(schedules)
    expect(rows.find(r => r.day === 'Monday')!.pct_of_total).toBe(50)
  })

  it('returns pct_of_total 0 for all days when schedules is empty', () => {
    const rows = transformWfhByDay([])
    rows.forEach(r => expect(r.pct_of_total).toBe(0))
  })

  it('sorts output by wfh_count descending', () => {
    const schedules = [
      sch({ date: '2026-04-08' }),  // Tuesday — 1 entry
      sch({ id: 'sch-2', date: '2026-04-07' }),  // Monday
      sch({ id: 'sch-3', date: '2026-04-07', employee_id: 'emp-2' }),  // Monday — 2 entries
    ]
    const rows = transformWfhByDay(schedules)
    expect(rows[0].day).toBe('Monday')
  })
})

// ─── transformWfhPerEmployee ──────────────────────────────────────────────────

describe('transformWfhPerEmployee', () => {
  it('counts WFH days per employee', () => {
    const schedules = [
      sch({ date: '2026-04-07' }),
      sch({ id: 'sch-2', date: '2026-04-08' }),
      sch({ id: 'sch-3', date: '2026-04-09' }),
    ]
    const [row] = transformWfhPerEmployee(schedules, [emp()], '2026-04-01', '2026-04-30')
    expect(row.wfh_days).toBe(3)
  })

  it('excludes employees with office_days_per_week === 5', () => {
    const schedules = [sch()]
    const employees = [emp({ office_days_per_week: 5, last_name: 'Wirth' })]
    expect(transformWfhPerEmployee(schedules, employees, '2026-04-01', '2026-04-30')).toHaveLength(0)
  })

  it('computes entitlement as (5 - office_days) * weeks in range', () => {
    // 28-day range = 4 weeks; employee has 4 office days → 1 WFH/week → entitlement = 4
    const [row] = transformWfhPerEmployee(
      [sch()],
      [emp({ office_days_per_week: 4 })],
      '2026-04-01',
      '2026-04-28',
    )
    expect(row.total_wfh_entitlement).toBe(4)
  })

  it('computes utilisation_rate to one decimal place', () => {
    // 2 wfh_days / 4 entitlement = 50.0
    const schedules = [sch({ date: '2026-04-07' }), sch({ id: 'sch-2', date: '2026-04-14' })]
    const [row] = transformWfhPerEmployee(schedules, [emp()], '2026-04-01', '2026-04-28')
    expect(row.utilisation_rate).toBe(50)
  })
})

// ─── transformMonFriViolations ────────────────────────────────────────────────

describe('transformMonFriViolations', () => {
  it('returns only employees+months with schedule_mismatch on Mon or Fri', () => {
    const records = [
      rec({ date: '2026-04-07', is_compliant: false, flags: ['schedule_mismatch'] }), // Monday violation
      rec({ id: 'r2', date: '2026-04-08', is_compliant: false, flags: ['missing_clocking'] }), // Tuesday, different flag
      rec({ id: 'r3', date: '2026-04-09', is_compliant: true, flags: [] }), // compliant
    ]
    const rows = transformMonFriViolations(records, [emp()])
    expect(rows).toHaveLength(1)
    expect(rows[0].violation_count).toBe(1)
  })

  it('ignores schedule_mismatch on mid-week days', () => {
    // Wednesday = getDay 3
    const records = [
      rec({ date: '2026-04-09', is_compliant: false, flags: ['schedule_mismatch'] }), // Wednesday
    ]
    expect(transformMonFriViolations(records, [emp()])).toHaveLength(0)
  })

  it('groups violations by employee AND calendar month', () => {
    const records = [
      rec({ id: 'r1', date: '2026-04-07', is_compliant: false, flags: ['schedule_mismatch'] }),  // Apr Mon
      rec({ id: 'r2', date: '2026-04-14', is_compliant: false, flags: ['schedule_mismatch'] }),  // Apr Mon
      rec({ id: 'r3', date: '2026-05-05', is_compliant: false, flags: ['schedule_mismatch'] }),  // May Mon
    ]
    const rows = transformMonFriViolations(records, [emp()])
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.month === 'April 2026')!.violation_count).toBe(2)
    expect(rows.find(r => r.month === 'May 2026')!.violation_count).toBe(1)
  })

  it('counts Monday and Friday violations separately', () => {
    const records = [
      rec({ id: 'r1', date: '2026-04-07', is_compliant: false, flags: ['schedule_mismatch'] }),  // Monday
      rec({ id: 'r2', date: '2026-04-11', is_compliant: false, flags: ['schedule_mismatch'] }),  // Friday
    ]
    const [row] = transformMonFriViolations(records, [emp()])
    expect(row.monday_wfh).toBe(1)
    expect(row.friday_wfh).toBe(1)
    expect(row.violation_count).toBe(2)
  })

  it('populates violation_dates as formatted short dates', () => {
    const records = [
      rec({ date: '2026-04-07', is_compliant: false, flags: ['schedule_mismatch'] }),
    ]
    const [row] = transformMonFriViolations(records, [emp()])
    expect(row.violation_dates).toEqual(['Apr 7'])
  })

  it('returns empty array when no violations', () => {
    expect(transformMonFriViolations([rec()], [emp()])).toHaveLength(0)
  })
})
