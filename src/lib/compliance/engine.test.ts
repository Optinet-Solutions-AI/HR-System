/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getISOWeekNumber,
  isWeekend,
  checkLocationAgainstOffices,
  getMondayFridayLimits,
  processEmployeeDate,
} from './engine'
import {
  makeEmployee,
  makeClocking,
  makeBrokenClocking,
  makeBooking,
  makeSchedule,
  makeScheduleRule,
  makeOfficeLocation,
  NIKLAS,
  CHRISTIAN,
  DARREN,
  REDVERS,
  TINA,
  OLIVIER,
  SALVO,
  OFFICE_GPS,
  REDVERS_WRONG_GPS,
  TINA_NEAR_GPS,
} from '@/lib/test-utils/factories'
import type { OfficeLocation } from './geofence'

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const OFFICES: OfficeLocation[] = [makeOfficeLocation()]
const DEFAULT_LIMITS = { monday: 1, friday: 1 }

// ═══════════════════════════════════════════════════════════════════════════
// Helper function tests
// ═══════════════════════════════════════════════════════════════════════════

describe('getISOWeekNumber', () => {
  it('returns correct ISO week for 2026-04-07 (week 15)', () => {
    expect(getISOWeekNumber('2026-04-07')).toBe(15)
  })

  it('handles year boundary — 2025-12-29 is week 1 of 2026', () => {
    // ISO 8601: 2025-12-29 is Monday of week 1 of 2026
    expect(getISOWeekNumber('2025-12-29')).toBe(1)
  })

  it('returns week 1 for early January', () => {
    expect(getISOWeekNumber('2026-01-01')).toBe(1)
  })
})

describe('isWeekend', () => {
  it('returns true for Saturday (2026-04-11)', () => {
    expect(isWeekend('2026-04-11')).toBe(true)
  })

  it('returns true for Sunday (2026-04-12)', () => {
    expect(isWeekend('2026-04-12')).toBe(true)
  })

  it('returns false for Monday (2026-04-06)', () => {
    expect(isWeekend('2026-04-06')).toBe(false)
  })

  it('returns false for Friday (2026-04-10)', () => {
    expect(isWeekend('2026-04-10')).toBe(false)
  })

  it('returns false for Wednesday (2026-04-08)', () => {
    expect(isWeekend('2026-04-08')).toBe(false)
  })
})

describe('checkLocationAgainstOffices', () => {
  it('returns null when lat and lng are both null', () => {
    expect(checkLocationAgainstOffices(null, null, OFFICES)).toBeNull()
  })

  it('returns null when lat is null', () => {
    expect(checkLocationAgainstOffices(null, OFFICE_GPS.lng, OFFICES)).toBeNull()
  })

  it('returns null when lng is null', () => {
    expect(checkLocationAgainstOffices(OFFICE_GPS.lat, null, OFFICES)).toBeNull()
  })

  it('returns true when within any one of multiple offices', () => {
    const offices = [
      makeOfficeLocation({ latitude: 36.0, longitude: 15.0, radius_meters: 100 }),
      makeOfficeLocation({ id: 'loc-2', latitude: OFFICE_GPS.lat, longitude: OFFICE_GPS.lng }),
    ]
    expect(checkLocationAgainstOffices(OFFICE_GPS.lat, OFFICE_GPS.lng, offices)).toBe(true)
  })

  it('returns false when outside all offices', () => {
    expect(checkLocationAgainstOffices(36.0, 15.0, OFFICES)).toBe(false)
  })
})

describe('getMondayFridayLimits', () => {
  it('returns { monday: 1, friday: 1 } with empty rules', () => {
    expect(getMondayFridayLimits([])).toEqual({ monday: 1, friday: 1 })
  })

  it('extracts custom limits from active MAX_WFH_PER_DAY_OF_WEEK rules', () => {
    const rules = [
      makeScheduleRule({ value: { dayOfWeek: 'Monday', maxPerMonth: 2 } }),
      makeScheduleRule({ id: 'rule-2', name: 'Max WFH Friday', value: { dayOfWeek: 'Friday', maxPerMonth: 3 } }),
    ]
    expect(getMondayFridayLimits(rules)).toEqual({ monday: 2, friday: 3 })
  })

  it('ignores inactive rules', () => {
    const rules = [
      makeScheduleRule({ is_active: false, value: { dayOfWeek: 'Monday', maxPerMonth: 5 } }),
    ]
    expect(getMondayFridayLimits(rules)).toEqual({ monday: 1, friday: 1 })
  })

  it('ignores rules with wrong rule_type', () => {
    const rules = [
      makeScheduleRule({ rule_type: 'MAX_WFH_PER_DAY', value: { maxCount: 3 } }),
    ]
    expect(getMondayFridayLimits(rules)).toEqual({ monday: 1, friday: 1 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// processEmployeeDate — Core Compliance Logic
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Edge case 10: Olivier — no Talexio ID
// ---------------------------------------------------------------------------

describe('A. No Talexio ID (Olivier scenario)', () => {
  it('returns is_compliant: true with "No Talexio ID" comment', () => {
    const result = processEmployeeDate(
      OLIVIER, '2026-04-07',
      makeSchedule({ employee_id: OLIVIER.id, status: 'office' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(true)
    expect(result.comment).toContain('No Talexio ID')
  })

  it('returns actual_status: "unknown"', () => {
    const result = processEmployeeDate(
      OLIVIER, '2026-04-07',
      undefined, undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('unknown')
  })

  it('returns empty flags array', () => {
    const result = processEmployeeDate(
      OLIVIER, '2026-04-07',
      undefined, undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toEqual([])
  })

  it('sets has_clocking: false regardless of clocking data', () => {
    const clocking = makeClocking({ employee_id: OLIVIER.id })
    const result = processEmployeeDate(
      OLIVIER, '2026-04-07',
      undefined, clocking, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.has_clocking).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge case 7: Public holiday
// ---------------------------------------------------------------------------

describe('B. Public holiday', () => {
  const emp = makeEmployee({ id: 'emp-ph' })

  it('returns is_compliant: true with expected/actual "public_holiday"', () => {
    const result = processEmployeeDate(
      emp, '2026-04-03',
      undefined, undefined, undefined, true, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(true)
    expect(result.expected_status).toBe('public_holiday')
    expect(result.actual_status).toBe('public_holiday')
    expect(result.flags).toEqual([])
  })

  it('sets has_clocking based on whether clocking exists', () => {
    const withClocking = processEmployeeDate(
      emp, '2026-04-03',
      undefined, makeClocking({ employee_id: emp.id }), undefined,
      true, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(withClocking.has_clocking).toBe(true)

    const withoutClocking = processEmployeeDate(
      emp, '2026-04-03',
      undefined, undefined, undefined,
      true, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(withoutClocking.has_clocking).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge case 6: Approved vacation / Sick leave
// ---------------------------------------------------------------------------

describe('C. Vacation / Sick leave', () => {
  const emp = makeEmployee({ id: 'emp-vac' })

  it('returns is_compliant: true for vacation', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'vacation' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(true)
    expect(result.actual_status).toBe('vacation')
    expect(result.flags).toEqual([])
  })

  it('returns is_compliant: true for sick_leave', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'sick_leave' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(true)
    expect(result.actual_status).toBe('vacation')
  })
})

// ---------------------------------------------------------------------------
// Edge case 4: Broken clocking detection
// ---------------------------------------------------------------------------

describe('D. Broken clocking detection', () => {
  const emp = makeEmployee({ id: 'emp-brk' })

  it('detects broken clocking via clocking_status field', () => {
    const clocking = makeClocking({
      employee_id: emp.id,
      clocking_status: 'Broken clocking',
      time_out: '18:00', // has time_out but status says broken
    })
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      clocking, makeBooking({ employee_id: emp.id }), false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('broken_clocking')
  })

  it('detects broken clocking when time_in exists but time_out is null', () => {
    const clocking = makeBrokenClocking({ employee_id: emp.id })
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      clocking, makeBooking({ employee_id: emp.id }), false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('broken_clocking')
    expect(result.flags).toContain('missing_clock_out')
    expect(result.flags).toContain('clocking_not_closed')
  })
})

// ---------------------------------------------------------------------------
// Edge case 9: Niklas — 5 office days, no clocking
// ---------------------------------------------------------------------------

describe('E. Office day — no clocking (Niklas scenario)', () => {
  it('sets actual_status "no_clocking" and flags ["missing_clocking"]', () => {
    const result = processEmployeeDate(
      NIKLAS, '2026-04-07',
      makeSchedule({ employee_id: NIKLAS.id, status: 'office' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('no_clocking')
    expect(result.flags).toContain('missing_clocking')
  })

  it('does NOT flag "wrong_location" — only "missing_clocking"', () => {
    const result = processEmployeeDate(
      NIKLAS, '2026-04-07',
      makeSchedule({ employee_id: NIKLAS.id, status: 'office' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('wrong_location')
  })

  it('sets is_compliant: false', () => {
    const result = processEmployeeDate(
      NIKLAS, '2026-04-07',
      makeSchedule({ employee_id: NIKLAS.id, status: 'office' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge case 4 on office day: Broken clocking
// ---------------------------------------------------------------------------

describe('E. Office day — broken clocking', () => {
  const emp = makeEmployee({ id: 'emp-office-brk' })

  it('sets actual_status "broken_clocking" and flags missing_clock_out + clocking_not_closed', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      makeBrokenClocking({ employee_id: emp.id }),
      makeBooking({ employee_id: emp.id }),
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('broken_clocking')
    expect(result.flags).toContain('missing_clock_out')
    expect(result.flags).toContain('clocking_not_closed')
  })

  it('also flags "no_desk_booking" if no booking exists', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      makeBrokenClocking({ employee_id: emp.id }),
      undefined, // no booking
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toContain('no_desk_booking')
    expect(result.flags).toContain('missing_clock_out')
  })
})

// ---------------------------------------------------------------------------
// Edge case 5: Wrong GPS on office day (Redvers)
// ---------------------------------------------------------------------------

describe('E. Office day — wrong location (Redvers scenario)', () => {
  it('sets actual_status "wrong_location" and flags ["wrong_location"]', () => {
    const clocking = makeClocking({
      employee_id: REDVERS.id,
      location_in_lat: REDVERS_WRONG_GPS.lat,
      location_in_lng: REDVERS_WRONG_GPS.lng,
    })
    const result = processEmployeeDate(
      REDVERS, '2026-04-07',
      makeSchedule({ employee_id: REDVERS.id, status: 'office' }),
      clocking, makeBooking({ employee_id: REDVERS.id }),
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('wrong_location')
    expect(result.flags).toContain('wrong_location')
  })
})

// ---------------------------------------------------------------------------
// Office day — correct location (happy path)
// ---------------------------------------------------------------------------

describe('E. Office day — correct location', () => {
  const emp = makeEmployee({ id: 'emp-ok' })

  it('sets actual_status "in_office_confirmed" with no flags when booking exists', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      makeClocking({ employee_id: emp.id }),
      makeBooking({ employee_id: emp.id }),
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('in_office_confirmed')
    expect(result.flags).toEqual([])
    expect(result.is_compliant).toBe(true)
  })

  it('assumes office when GPS is null (no wrong_location flag)', () => {
    const clocking = makeClocking({
      employee_id: emp.id,
      location_in_lat: null,
      location_in_lng: null,
    })
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      clocking, makeBooking({ employee_id: emp.id }),
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('in_office_confirmed')
    expect(result.flags).not.toContain('wrong_location')
    expect(result.location_match).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Edge case 13: No desk booking on office day
// ---------------------------------------------------------------------------

describe('E. Office day — no desk booking', () => {
  const emp = makeEmployee({ id: 'emp-nobk' })

  it('adds "no_desk_booking" as the only flag when location is correct', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      makeClocking({ employee_id: emp.id }),
      undefined, // no booking
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toEqual(['no_desk_booking'])
    expect(result.actual_status).toBe('in_office_confirmed')
    expect(result.is_compliant).toBe(false)
  })

  it('has clocking but flags no_desk_booking, not missing_clocking', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'office' }),
      makeClocking({ employee_id: emp.id }),
      undefined,
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('missing_clocking')
    expect(result.flags).toContain('no_desk_booking')
    expect(result.has_clocking).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Edge case 12: Office on WFH day — NOT a violation
// ---------------------------------------------------------------------------

describe('E. WFH day — employee came to office', () => {
  const emp = makeEmployee({ id: 'emp-wfh-office' })

  it('sets actual_status "in_office_confirmed" — NOT a violation', () => {
    const clocking = makeClocking({ employee_id: emp.id }) // office GPS
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'wfh' }),
      clocking, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('in_office_confirmed')
  })

  it('returns no "wrong_location" or "schedule_mismatch" flag', () => {
    const clocking = makeClocking({ employee_id: emp.id })
    const result = processEmployeeDate(
      emp, '2026-04-07',
      makeSchedule({ employee_id: emp.id, status: 'wfh' }),
      clocking, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('wrong_location')
    expect(result.flags).not.toContain('schedule_mismatch')
  })

  it('is_compliant: true (no flags)', () => {
    const clocking = makeClocking({ employee_id: emp.id })
    const result = processEmployeeDate(
      emp, '2026-04-08', // Wednesday — not Mon/Fri
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      clocking, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.is_compliant).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// WFH day — broken clocking
// ---------------------------------------------------------------------------

describe('E. WFH day — broken clocking', () => {
  const emp = makeEmployee({ id: 'emp-wfh-brk' })

  it('flags "missing_clock_out" and "clocking_not_closed"', () => {
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      makeBrokenClocking({ employee_id: emp.id, date: '2026-04-08' }),
      undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('broken_clocking')
    expect(result.flags).toContain('missing_clock_out')
    expect(result.flags).toContain('clocking_not_closed')
  })
})

// ---------------------------------------------------------------------------
// WFH day — no clocking
// ---------------------------------------------------------------------------

describe('E. WFH day — no clocking', () => {
  const emp = makeEmployee({ id: 'emp-wfh-noclk' })

  it('flags "missing_clocking"', () => {
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      undefined, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('no_clocking')
    expect(result.flags).toContain('missing_clocking')
  })
})

// ---------------------------------------------------------------------------
// WFH day — confirmed WFH
// ---------------------------------------------------------------------------

describe('E. WFH day — confirmed WFH', () => {
  const emp = makeEmployee({ id: 'emp-wfh-ok' })

  it('sets actual_status "wfh_confirmed" when GPS is outside office', () => {
    const clocking = makeClocking({
      employee_id: emp.id,
      location_in_lat: REDVERS_WRONG_GPS.lat,
      location_in_lng: REDVERS_WRONG_GPS.lng,
    })
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      clocking, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('wfh_confirmed')
  })

  it('sets actual_status "wfh_confirmed" when GPS is null', () => {
    const clocking = makeClocking({
      employee_id: emp.id,
      location_in_lat: null,
      location_in_lng: null,
    })
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      clocking, undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('wfh_confirmed')
  })
})

// ---------------------------------------------------------------------------
// No schedule entry
// ---------------------------------------------------------------------------

describe('E. No schedule entry', () => {
  const emp = makeEmployee({ id: 'emp-nosched' })

  it('returns "in_office_confirmed" when clocking matches office GPS', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      undefined, // no schedule
      makeClocking({ employee_id: emp.id }),
      undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('in_office_confirmed')
  })

  it('returns "unknown" with comment when clocking exists but GPS is not office', () => {
    const clocking = makeClocking({
      employee_id: emp.id,
      location_in_lat: REDVERS_WRONG_GPS.lat,
      location_in_lng: REDVERS_WRONG_GPS.lng,
    })
    const result = processEmployeeDate(
      emp, '2026-04-07',
      undefined,
      clocking, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('unknown')
    expect(result.comment).toBe('No schedule entry')
  })

  it('returns "unknown" with "No schedule entry and no clocking data" when no clocking', () => {
    const result = processEmployeeDate(
      emp, '2026-04-07',
      undefined, undefined, undefined,
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('unknown')
    expect(result.comment).toBe('No schedule entry and no clocking data')
  })
})

// ---------------------------------------------------------------------------
// Edge cases 2+3: Weekly WFH limit
// ---------------------------------------------------------------------------

describe('F. Weekly WFH limit', () => {
  it('flags "exceeded_wfh_days" when weeklyWfhCount > (5 - office_days_per_week)', () => {
    const emp = makeEmployee({ id: 'emp-wfh-exceed', office_days_per_week: 4 })
    // Allowed WFH = 5 - 4 = 1; weeklyWfhCount = 2 → exceeds
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, location_in_lat: REDVERS_WRONG_GPS.lat, location_in_lng: REDVERS_WRONG_GPS.lng }),
      undefined, false, OFFICES, 2, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toContain('exceeded_wfh_days')
  })

  it('does not flag when weeklyWfhCount equals the limit', () => {
    const emp = makeEmployee({ id: 'emp-wfh-exact', office_days_per_week: 4 })
    // Allowed = 1; weeklyWfhCount = 1 → at the limit, not exceeding
    const result = processEmployeeDate(
      emp, '2026-04-08',
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, location_in_lat: REDVERS_WRONG_GPS.lat, location_in_lng: REDVERS_WRONG_GPS.lng }),
      undefined, false, OFFICES, 1, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('exceeded_wfh_days')
  })

  it('Christian (1 office day) — exceeds at weeklyWfhCount > 4', () => {
    const result = processEmployeeDate(
      CHRISTIAN, '2026-04-08',
      makeSchedule({ employee_id: CHRISTIAN.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: CHRISTIAN.id, location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES, 5, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toContain('exceeded_wfh_days')
  })

  it('Christian (1 office day) — does not exceed at weeklyWfhCount = 4', () => {
    const result = processEmployeeDate(
      CHRISTIAN, '2026-04-08',
      makeSchedule({ employee_id: CHRISTIAN.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: CHRISTIAN.id, location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES, 4, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('exceeded_wfh_days')
  })

  it('Darren (2 office days) — exceeds at weeklyWfhCount > 3', () => {
    const result = processEmployeeDate(
      DARREN, '2026-04-08',
      makeSchedule({ employee_id: DARREN.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: DARREN.id, location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES, 4, 0, 0, DEFAULT_LIMITS
    )
    expect(result.flags).toContain('exceeded_wfh_days')
  })
})

// ---------------------------------------------------------------------------
// Edge case 14: Monthly Monday/Friday check
// ---------------------------------------------------------------------------

describe('G. Monthly Monday/Friday check', () => {
  const emp = makeEmployee({ id: 'emp-monfri', office_days_per_week: 2 })

  it('flags "schedule_mismatch" when Monday WFH count exceeds limit', () => {
    const result = processEmployeeDate(
      emp, '2026-04-06', // Monday
      makeSchedule({ employee_id: emp.id, date: '2026-04-06', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, date: '2026-04-06', location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES,
      1,  // weeklyWfhCount
      2,  // monthlyMondayWfhCount — exceeds limit of 1
      0,
      DEFAULT_LIMITS
    )
    expect(result.flags).toContain('schedule_mismatch')
  })

  it('flags "schedule_mismatch" when Friday WFH count exceeds limit', () => {
    const result = processEmployeeDate(
      emp, '2026-04-10', // Friday
      makeSchedule({ employee_id: emp.id, date: '2026-04-10', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, date: '2026-04-10', location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES,
      1,
      0,
      2,  // monthlyFridayWfhCount — exceeds limit of 1
      DEFAULT_LIMITS
    )
    expect(result.flags).toContain('schedule_mismatch')
  })

  it('does not flag on Tuesday/Wednesday/Thursday', () => {
    const result = processEmployeeDate(
      emp, '2026-04-08', // Wednesday
      makeSchedule({ employee_id: emp.id, date: '2026-04-08', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, date: '2026-04-08', location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES, 1, 5, 5, DEFAULT_LIMITS
    )
    expect(result.flags).not.toContain('schedule_mismatch')
  })

  it('does not flag when count equals the limit', () => {
    const result = processEmployeeDate(
      emp, '2026-04-06', // Monday
      makeSchedule({ employee_id: emp.id, date: '2026-04-06', status: 'wfh' }),
      makeClocking({ employee_id: emp.id, date: '2026-04-06', location_in_lat: null, location_in_lng: null }),
      undefined, false, OFFICES, 1, 1, 0, DEFAULT_LIMITS // mondayCount = 1, limit = 1
    )
    expect(result.flags).not.toContain('schedule_mismatch')
  })

  it('does not flag when expectedStatus is not "wfh"', () => {
    const result = processEmployeeDate(
      emp, '2026-04-06', // Monday
      makeSchedule({ employee_id: emp.id, date: '2026-04-06', status: 'office' }),
      makeClocking({ employee_id: emp.id, date: '2026-04-06' }),
      makeBooking({ employee_id: emp.id, date: '2026-04-06' }),
      false, OFFICES, 0, 5, 5, DEFAULT_LIMITS // high counts but office day
    )
    expect(result.flags).not.toContain('schedule_mismatch')
  })
})

// ---------------------------------------------------------------------------
// Edge case 15: Tina April 7 — combined scenario
// ---------------------------------------------------------------------------

describe('Combined: Tina April 7 scenario', () => {
  it('broken clocking at ~900m from office on office day produces multiple flags', () => {
    const clocking = makeBrokenClocking({
      employee_id: TINA.id,
      date: '2026-04-07',
      location_in_lat: TINA_NEAR_GPS.lat,
      location_in_lng: TINA_NEAR_GPS.lng,
    })
    const result = processEmployeeDate(
      TINA, '2026-04-07',
      makeSchedule({ employee_id: TINA.id, status: 'office' }),
      clocking,
      undefined, // no booking
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    // Broken clocking is checked BEFORE location in the engine's control flow,
    // so actual_status is 'broken_clocking', not 'wrong_location'
    expect(result.actual_status).toBe('broken_clocking')
    expect(result.flags).toContain('missing_clock_out')
    expect(result.flags).toContain('clocking_not_closed')
    expect(result.flags).toContain('no_desk_booking')
    expect(result.is_compliant).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge case 8: Salvo/Salvatore — notes field
// ---------------------------------------------------------------------------

describe('Salvo/Salvatore special case', () => {
  it('processes normally — notes field does not affect compliance logic', () => {
    const result = processEmployeeDate(
      SALVO, '2026-04-07',
      makeSchedule({ employee_id: SALVO.id, status: 'office' }),
      makeClocking({ employee_id: SALVO.id }),
      makeBooking({ employee_id: SALVO.id }),
      false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    expect(result.actual_status).toBe('in_office_confirmed')
    expect(result.is_compliant).toBe(true)
    expect(result.flags).toEqual([])
  })

  it('employee notes are not included in compliance_record output', () => {
    const result = processEmployeeDate(
      SALVO, '2026-04-07',
      makeSchedule({ employee_id: SALVO.id, status: 'office' }),
      undefined, undefined, false, OFFICES, 0, 0, 0, DEFAULT_LIMITS
    )
    // The result is a compliance_record insert — it has no "notes" field
    expect(result).not.toHaveProperty('notes')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// runCompliance — Integration tests with mocked Supabase
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabaseClient: vi.fn(),
}))

vi.mock('@/lib/compliance/geofence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/compliance/geofence')>()
  return {
    ...actual,
    getOfficeLocations: vi.fn(),
  }
})

import { runCompliance } from './engine'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getOfficeLocations } from '@/lib/compliance/geofence'

function setupMockAdmin(data: {
  employees: any[]
  holidays: any[]
  schedules: any[]
  clockings: any[]
  bookings: any[]
  rules: any[]
  upsertError?: any
}) {
  const upsertMock = vi.fn().mockResolvedValue({ error: data.upsertError ?? null })

  const fromMock = vi.fn((table: string) => {
    const tableData: Record<string, any> = {
      employees: data.employees,
      public_holidays: data.holidays,
      schedules: data.schedules,
      clockings: data.clockings,
      bookings: data.bookings,
      schedule_rules: data.rules,
    }

    const makeChain = (result: any) => ({
      eq: vi.fn().mockReturnValue(result),
      gte: vi.fn().mockReturnValue({
        lte: vi.fn().mockReturnValue(result),
      }),
    })

    return {
      select: vi.fn().mockReturnValue(
        makeChain({ data: tableData[table] ?? [], error: null })
      ),
      upsert: upsertMock,
    }
  })

  vi.mocked(createAdminSupabaseClient).mockReturnValue({ from: fromMock } as any)
  vi.mocked(getOfficeLocations).mockResolvedValue([makeOfficeLocation()])

  return { fromMock, upsertMock }
}

describe('runCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Edge case 11: Saturday clockings — skips weekends unless scheduled
  it('skips weekends when no schedule entry exists', async () => {
    const emp = makeEmployee({ id: 'emp-wknd' })
    setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [],
      clockings: [],
      bookings: [],
      rules: [],
    })

    // Saturday April 11, 2026
    const result = await runCompliance('2026-04-11', '2026-04-12')
    // Weekend days with no schedule → skipped → 0 records
    expect(result.processed).toBe(0)
  })

  it('processes Saturday when employee has an explicit schedule entry', async () => {
    const emp = makeEmployee({ id: 'emp-sat' })
    setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [makeSchedule({ employee_id: emp.id, date: '2026-04-11', status: 'office' })],
      clockings: [],
      bookings: [],
      rules: [],
    })

    const result = await runCompliance('2026-04-11', '2026-04-11')
    expect(result.processed).toBe(1)
  })

  it('returns correct summary counts', async () => {
    const emp = makeEmployee({ id: 'emp-sum' })
    setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [
        makeSchedule({ employee_id: emp.id, date: '2026-04-07', status: 'office' }),
      ],
      clockings: [
        makeClocking({ employee_id: emp.id, date: '2026-04-07' }),
      ],
      bookings: [
        makeBooking({ employee_id: emp.id, date: '2026-04-07' }),
      ],
      rules: [],
    })

    const result = await runCompliance('2026-04-07', '2026-04-07')
    expect(result.processed).toBe(1)
    expect(result.compliant).toBe(1)
    expect(result.flagged).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('counts flagged records correctly', async () => {
    const emp = makeEmployee({ id: 'emp-flag' })
    setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [
        makeSchedule({ employee_id: emp.id, date: '2026-04-07', status: 'office' }),
      ],
      clockings: [], // no clocking → missing_clocking flag
      bookings: [],
      rules: [],
    })

    const result = await runCompliance('2026-04-07', '2026-04-07')
    expect(result.processed).toBe(1)
    expect(result.compliant).toBe(0)
    expect(result.flagged).toBe(1)
  })

  it('handles empty employee list gracefully', async () => {
    setupMockAdmin({
      employees: [],
      holidays: [],
      schedules: [],
      clockings: [],
      bookings: [],
      rules: [],
    })

    const result = await runCompliance('2026-04-07', '2026-04-07')
    expect(result.processed).toBe(0)
    expect(result.errors).toEqual([])
  })

  it('upserts records with onConflict employee_id,date', async () => {
    const emp = makeEmployee({ id: 'emp-ups' })
    const { upsertMock } = setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [makeSchedule({ employee_id: emp.id, date: '2026-04-07', status: 'office' })],
      clockings: [],
      bookings: [],
      rules: [],
    })

    await runCompliance('2026-04-07', '2026-04-07')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.any(Array),
      { onConflict: 'employee_id,date' }
    )
  })

  it('reports upsert errors in the errors array', async () => {
    const emp = makeEmployee({ id: 'emp-uperr' })
    setupMockAdmin({
      employees: [emp],
      holidays: [],
      schedules: [makeSchedule({ employee_id: emp.id, date: '2026-04-07', status: 'office' })],
      clockings: [],
      bookings: [],
      rules: [],
      upsertError: { message: 'upsert failed' },
    })

    const result = await runCompliance('2026-04-07', '2026-04-07')
    expect(result.errors).toContain('Upsert failed: upsert failed')
  })

  it('throws when employee fetch fails', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'employees') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ data: null, error: { message: 'db down' } }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ data: [], error: null }),
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockReturnValue({ data: [], error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    vi.mocked(createAdminSupabaseClient).mockReturnValue({ from: fromMock } as any)
    vi.mocked(getOfficeLocations).mockResolvedValue([makeOfficeLocation()])

    await expect(runCompliance('2026-04-07', '2026-04-07')).rejects.toThrow('Failed to fetch employees')
  })
})
