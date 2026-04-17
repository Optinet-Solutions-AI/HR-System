import { describe, it, expect } from 'vitest'
import { validateScheduleSelections } from './validation'
import {
  makeScheduleRule,
  makePublicHoliday,
} from '@/lib/test-utils/factories'
import type { ScheduleRule, PublicHoliday } from '@/lib/types/app'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sel(date: string, status: 'wfh' | 'office' = 'wfh') {
  return { date, status }
}

const NO_HOLIDAYS: PublicHoliday[] = []
const NO_RULES: ScheduleRule[] = []

const MONDAY_FRIDAY_RULES: ScheduleRule[] = [
  makeScheduleRule({ id: 'r-mon', value: { dayOfWeek: 'Monday', maxPerMonth: 1 } }),
  makeScheduleRule({ id: 'r-fri', name: 'Max WFH Friday', value: { dayOfWeek: 'Friday', maxPerMonth: 1 } }),
]

// ---------------------------------------------------------------------------
// Edge case 1: 5 office days — READ_ONLY guard (Niklas, Mohamed, etc.)
// ---------------------------------------------------------------------------

describe('5 office days — read-only guard', () => {
  it('returns READ_ONLY violation when WFH is selected with officeDaysPerWeek=5', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-07')],
      officeDaysPerWeek: 5,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('READ_ONLY')
  })

  it('returns valid when no WFH selections exist for officeDaysPerWeek=5', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-07', 'office')],
      officeDaysPerWeek: 5,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('short-circuits — does not check weekly/monthly rules when officeDaysPerWeek=5', () => {
    // Even with 10 WFH selections on Mondays, only READ_ONLY should appear
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-06'), sel('2026-04-13'), sel('2026-04-20'), sel('2026-04-27')],
      officeDaysPerWeek: 5,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: MONDAY_FRIDAY_RULES,
    })
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].type).toBe('READ_ONLY')
  })
})

// ---------------------------------------------------------------------------
// Edge case 2: 1 office day (Christian) — 4 WFH slots per week
// ---------------------------------------------------------------------------

describe('1 office day — 4 WFH slots per week', () => {
  it('allows 4 WFH days in a single week', () => {
    // Week of April 6-10: Mon-Thu as WFH (4 days)
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed
        sel('2026-04-09'), // Thu
      ],
      officeDaysPerWeek: 1,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(true)
  })

  it('flags EXCEEDED_WFH_PER_WEEK when 5 WFH days in a week', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed
        sel('2026-04-09'), // Thu
        sel('2026-04-10'), // Fri
      ],
      officeDaysPerWeek: 1,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'EXCEEDED_WFH_PER_WEEK')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Edge case 3: 2 office days (Darren, Alec) — 3 WFH slots per week
// ---------------------------------------------------------------------------

describe('2 office days — 3 WFH slots per week', () => {
  it('allows 3 WFH days in a single week', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed
        sel('2026-04-09'), // Thu
      ],
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(true)
  })

  it('flags EXCEEDED_WFH_PER_WEEK when 4 WFH days in a week', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed
        sel('2026-04-09'), // Thu
      ],
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'EXCEEDED_WFH_PER_WEEK')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Standard 4 office days — 1 WFH per week
// ---------------------------------------------------------------------------

describe('4 office days — 1 WFH slot per week', () => {
  it('allows 1 WFH day per week', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-08')], // Wed, week 15
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(true)
  })

  it('flags EXCEEDED_WFH_PER_WEEK when 2 WFH days in one week', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed — same week
      ],
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'EXCEEDED_WFH_PER_WEEK')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

describe('date validation', () => {
  it('flags INVALID_DATE when selection is outside the specified month', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-05-01')],
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations[0].type).toBe('INVALID_DATE')
  })

  it('flags WEEKEND_SELECTED when a Saturday is selected', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-11')], // Saturday
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations[0].type).toBe('WEEKEND_SELECTED')
  })

  it('flags WEEKEND_SELECTED when a Sunday is selected', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-12')], // Sunday
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations[0].type).toBe('WEEKEND_SELECTED')
  })
})

// ---------------------------------------------------------------------------
// Edge case 7: Public holiday conflicts
// ---------------------------------------------------------------------------

describe('public holiday conflicts', () => {
  const holidays = [makePublicHoliday({ date: '2026-04-03' })]

  it('flags HOLIDAY_CONFLICT when WFH is selected on a public holiday', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-03')],
      officeDaysPerWeek: 4,
      publicHolidays: holidays,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    expect(result.violations.some((v) => v.type === 'HOLIDAY_CONFLICT')).toBe(true)
  })

  it('does not flag non-holiday dates', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-07')],
      officeDaysPerWeek: 4,
      publicHolidays: holidays,
      scheduleRules: NO_RULES,
    })
    expect(result.violations.some((v) => v.type === 'HOLIDAY_CONFLICT')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge case 14: Monday/Friday WFH limit
// ---------------------------------------------------------------------------

describe('Monday/Friday WFH limit', () => {
  it('allows 1 WFH Monday per month with default rules', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-06')], // Monday
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: MONDAY_FRIDAY_RULES,
    })
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(false)
  })

  it('flags MONDAY_FRIDAY_LIMIT when 2+ WFH Mondays in a month', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon week 15
        sel('2026-04-13'), // Mon week 16
        // Other days to avoid EXCEEDED_WFH_PER_WEEK in same weeks
      ],
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: MONDAY_FRIDAY_RULES,
    })
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(true)
  })

  it('allows 1 WFH Friday per month with default rules', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-10')], // Friday
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: MONDAY_FRIDAY_RULES,
    })
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(false)
  })

  it('flags MONDAY_FRIDAY_LIMIT when 2+ WFH Fridays in a month', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-10'), // Fri week 15
        sel('2026-04-17'), // Fri week 16
      ],
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: MONDAY_FRIDAY_RULES,
    })
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(true)
  })

  it('respects custom maxPerMonth from schedule_rules', () => {
    const rules = [
      makeScheduleRule({ value: { dayOfWeek: 'Monday', maxPerMonth: 3 } }),
    ]
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon
        sel('2026-04-13'), // Mon
        sel('2026-04-20'), // Mon
      ],
      officeDaysPerWeek: 1,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: rules,
    })
    // 3 Mondays with max 3 — should be allowed
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(false)
  })

  it('uses default limit of 1 when no matching rules exist', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-06'), // Mon
        sel('2026-04-13'), // Mon
      ],
      officeDaysPerWeek: 2,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES, // no rules — default to 1
    })
    expect(result.violations.some((v) => v.type === 'MONDAY_FRIDAY_LIMIT')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multiple violations in a single call
// ---------------------------------------------------------------------------

describe('combined violations', () => {
  it('returns all applicable violations in a single call', () => {
    const holidays = [makePublicHoliday({ date: '2026-04-03' })]
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [
        sel('2026-04-03'), // holiday (Fri)
        sel('2026-04-07'), // Tue
        sel('2026-04-08'), // Wed — same week, exceeds WFH-per-week for 4-day employees
      ],
      officeDaysPerWeek: 4,
      publicHolidays: holidays,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(false)
    const types = result.violations.map((v) => v.type)
    expect(types).toContain('HOLIDAY_CONFLICT')
    expect(types).toContain('EXCEEDED_WFH_PER_WEEK')
  })

  it('returns valid: true when no violations exist', () => {
    const result = validateScheduleSelections({
      month: '2026-04',
      selections: [sel('2026-04-08')], // single Wed
      officeDaysPerWeek: 4,
      publicHolidays: NO_HOLIDAYS,
      scheduleRules: NO_RULES,
    })
    expect(result.valid).toBe(true)
    expect(result.violations).toHaveLength(0)
  })
})
