# Reports Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/app/(admin)/reports/page.tsx` with three tabs — Attendance, WFH Utilization, Monday/Friday Analysis — each with a CSV export button and a shared date range bar with presets.

**Architecture:** Server component reads `?from`, `?to`, `?tab` URL params and fetches `compliance_records` + `schedules (wfh)` + `employees` in parallel, transforms them server-side into typed report rows, then passes all data as props to a `"use client"` shell. Tab switching is instant (no refetch). Date range changes trigger `router.push`, which re-runs the server component. CSV export is client-side via `papaparse`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase JS SDK, TanStack React Table v8, shadcn/ui (Tabs, Table, Button, Badge, Card), date-fns, papaparse, lucide-react, vitest (tests for transform logic only)

**Spec:** `docs/superpowers/specs/2026-04-11-reports-page-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/reports/transform.ts` | Create | Pure transform functions: raw Supabase rows → typed report data |
| `src/lib/reports/transform.test.ts` | Create | Vitest unit tests for all 4 transform functions |
| `src/lib/reports/export.ts` | Create | Client-side CSV download utility (papaparse) |
| `src/components/reports/attendance-tab.tsx` | Create | Tab 1: summary cards + TanStack compliance table |
| `src/components/reports/wfh-utilization-tab.tsx` | Create | Tab 2: popular-days ranked table + per-employee table |
| `src/components/reports/monday-friday-tab.tsx` | Create | Tab 3: violations table |
| `src/components/reports/reports-client.tsx` | Create | `"use client"` shell: date range bar, presets, Tabs, wires tabs |
| `src/app/(admin)/reports/page.tsx` | Modify | Replace stub: server fetches, transforms, renders ReportsClient |

---

## Task 1: Transform functions (TDD)

**Files:**
- Create: `src/lib/reports/transform.test.ts`
- Create: `src/lib/reports/transform.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reports/transform.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run test -- src/lib/reports/transform.test.ts
```

Expected: FAIL — `Cannot find module './transform'`

- [ ] **Step 3: Implement `src/lib/reports/transform.ts`**

Create `src/lib/reports/transform.ts`:

```typescript
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
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
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
    const isMonOrFri = dayIndex === 1 || dayIndex === 5
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
    if (dayIndex === 1) row.monday_wfh++
    if (dayIndex === 5) row.friday_wfh++
    row.violation_count++
    row.violation_dates.push(format(parseISO(record.date), 'MMM d'))
  }

  return Array.from(byKey.values())
    .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.month.localeCompare(b.month))
}
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run test -- src/lib/reports/transform.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/lib/reports/transform.ts src/lib/reports/transform.test.ts && git commit -m "feat(reports): add transform functions with tests"
```

---

## Task 2: CSV export utility

**Files:**
- Create: `src/lib/reports/export.ts`

- [ ] **Step 1: Create `src/lib/reports/export.ts`**

```typescript
import Papa from 'papaparse'

/**
 * Converts an array of objects to a CSV file and triggers a browser download.
 * Only call from client components — uses browser DOM APIs.
 */
export function downloadCsv(rows: object[], filename: string): void {
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/lib/reports/export.ts && git commit -m "feat(reports): add CSV download utility"
```

---

## Task 3: AttendanceTab component

**Files:**
- Create: `src/components/reports/attendance-tab.tsx`

- [ ] **Step 1: Create `src/components/reports/attendance-tab.tsx`**

```tsx
'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AttendanceRow } from '@/lib/reports/transform'
import { downloadCsv } from '@/lib/reports/export'

type Props = { rows: AttendanceRow[]; from: string; to: string }

function SortButton<T>({
  column,
  children,
}: {
  column: Column<T>
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting()}
      className="-ml-3"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const cls =
    rate >= 90
      ? 'bg-green-100 text-green-800'
      : rate >= 70
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'
  return <Badge className={cls}>{rate}%</Badge>
}

export function AttendanceTab({ rows, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'total_days',
      header: ({ column }) => <SortButton column={column}>Total Days</SortButton>,
    },
    {
      accessorKey: 'compliant_days',
      header: ({ column }) => <SortButton column={column}>Compliant</SortButton>,
    },
    {
      accessorKey: 'compliance_rate',
      header: ({ column }) => <SortButton column={column}>Rate</SortButton>,
      cell: ({ row }) => <RateBadge rate={row.original.compliance_rate} />,
    },
    {
      accessorKey: 'most_common_flag',
      header: 'Top Flag',
      cell: ({ row }) =>
        row.original.most_common_flag ? (
          <Badge variant="outline" className="font-normal">
            {row.original.most_common_flag.replace(/_/g, ' ')}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  const overallRate =
    rows.length > 0
      ? Math.round(
          (rows.reduce((s, r) => s + r.compliance_rate, 0) / rows.length) * 10,
        ) / 10
      : 0
  const flaggedCount = rows.filter(r => r.total_days - r.compliant_days > 0).length

  function handleExport() {
    const exportRows = rows.map(r => ({
      Employee: `${r.first_name} ${r.last_name}`,
      'Total Days': r.total_days,
      'Compliant Days': r.compliant_days,
      'Non-Compliant Days': r.total_days - r.compliant_days,
      'Compliance Rate %': r.compliance_rate,
      Flags:
        Object.entries(r.flag_counts)
          .map(([f, c]) => `${f}×${c}`)
          .join('; ') || '',
    }))
    downloadCsv(exportRows, `attendance_${from}_${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Overall Compliance Rate</p>
            <p className="text-3xl font-bold">{overallRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Employees with Violations</p>
            <p className="text-3xl font-bold">{flaggedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No compliance data for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/components/reports/attendance-tab.tsx && git commit -m "feat(reports): add AttendanceTab component"
```

---

## Task 4: WfhUtilizationTab component

**Files:**
- Create: `src/components/reports/wfh-utilization-tab.tsx`

- [ ] **Step 1: Create `src/components/reports/wfh-utilization-tab.tsx`**

```tsx
'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { WfhByDayRow, WfhPerEmpRow } from '@/lib/reports/transform'
import { downloadCsv } from '@/lib/reports/export'

type Props = {
  byDay: WfhByDayRow[]
  perEmp: WfhPerEmpRow[]
  from: string
  to: string
}

function SortButton<T>({
  column,
  children,
}: {
  column: Column<T>
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting()}
      className="-ml-3"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

function InlineBar({ pct }: { pct: number }) {
  return (
    <div className="w-40 bg-gray-100 rounded-full h-2">
      <div
        className="bg-blue-500 h-2 rounded-full"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

export function WfhUtilizationTab({ byDay, perEmp, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const perEmpColumns: ColumnDef<WfhPerEmpRow>[] = [
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'wfh_days',
      header: ({ column }) => <SortButton column={column}>WFH Days</SortButton>,
    },
    {
      accessorKey: 'total_wfh_entitlement',
      header: 'Entitlement',
    },
    {
      accessorKey: 'utilisation_rate',
      header: ({ column }) => <SortButton column={column}>Utilisation</SortButton>,
      cell: ({ row }) => `${row.original.utilisation_rate}%`,
    },
  ]

  const table = useReactTable({
    data: perEmp,
    columns: perEmpColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  function handleExport() {
    const popularRows = byDay.map(r => ({
      Day: r.day,
      'WFH Days': r.wfh_count,
      '% of Total': r.pct_of_total,
    }))
    const empRows = perEmp.map(r => ({
      Employee: `${r.first_name} ${r.last_name}`,
      'WFH Days': r.wfh_days,
      Entitlement: r.total_wfh_entitlement,
      'Utilisation %': r.utilisation_rate,
    }))
    // Two sections in one CSV, separated by a blank row
    downloadCsv(
      [
        { Section: 'Popular Days' },
        ...popularRows.map(r => ({ Section: '', ...r })),
        {},
        { Section: 'Per Employee' },
        ...empRows.map(r => ({ Section: '', ...r })),
      ],
      `wfh_utilization_${from}_${to}.csv`,
    )
  }

  return (
    <div className="space-y-8">
      {/* Section A: Popular Days */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Popular WFH Days</h3>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>WFH Days</TableHead>
                <TableHead>% of Total</TableHead>
                <TableHead>Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No WFH data for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                byDay.map(row => (
                  <TableRow key={row.day}>
                    <TableCell className="font-medium">{row.day}</TableCell>
                    <TableCell>{row.wfh_count}</TableCell>
                    <TableCell>{row.pct_of_total}%</TableCell>
                    <TableCell>
                      <InlineBar pct={row.pct_of_total} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Section B: Per Employee */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Per Employee</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {hg.headers.map(h => (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={perEmpColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No WFH schedules for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/components/reports/wfh-utilization-tab.tsx && git commit -m "feat(reports): add WfhUtilizationTab component"
```

---

## Task 5: MondayFridayTab component

**Files:**
- Create: `src/components/reports/monday-friday-tab.tsx`

- [ ] **Step 1: Create `src/components/reports/monday-friday-tab.tsx`**

```tsx
'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MonFriRow } from '@/lib/reports/transform'
import { downloadCsv } from '@/lib/reports/export'

type Props = { rows: MonFriRow[]; from: string; to: string }

function SortButton<T>({
  column,
  children,
}: {
  column: Column<T>
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting()}
      className="-ml-3"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

export function MondayFridayTab({ rows, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<MonFriRow>[] = [
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'month',
      header: ({ column }) => <SortButton column={column}>Month</SortButton>,
    },
    {
      accessorKey: 'monday_wfh',
      header: ({ column }) => <SortButton column={column}>Mon Violations</SortButton>,
    },
    {
      accessorKey: 'friday_wfh',
      header: ({ column }) => <SortButton column={column}>Fri Violations</SortButton>,
    },
    {
      accessorKey: 'violation_count',
      header: ({ column }) => <SortButton column={column}>Total</SortButton>,
    },
    {
      accessorKey: 'violation_dates',
      header: 'Dates',
      cell: ({ row }) => row.original.violation_dates.join(', '),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  const totalViolations = rows.reduce((s, r) => s + r.violation_count, 0)

  function handleExport() {
    const exportRows = rows.map(r => ({
      Employee: `${r.first_name} ${r.last_name}`,
      Month: r.month,
      'Monday Violations': r.monday_wfh,
      'Friday Violations': r.friday_wfh,
      'Total Violations': r.violation_count,
      'Violation Dates': r.violation_dates.join(', '),
    }))
    downloadCsv(exportRows, `monday_friday_violations_${from}_${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Card className="inline-flex">
          <CardContent className="flex items-center gap-4 pt-6 pb-6 px-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Violations</p>
              <p className="text-3xl font-bold">{totalViolations}</p>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No Mon/Fri rule violations for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/components/reports/monday-friday-tab.tsx && git commit -m "feat(reports): add MondayFridayTab component"
```

---

## Task 6: ReportsClient shell

**Files:**
- Create: `src/components/reports/reports-client.tsx`

- [ ] **Step 1: Create `src/components/reports/reports-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AttendanceTab } from './attendance-tab'
import { WfhUtilizationTab } from './wfh-utilization-tab'
import { MondayFridayTab } from './monday-friday-tab'
import type {
  AttendanceRow,
  WfhByDayRow,
  WfhPerEmpRow,
  MonFriRow,
} from '@/lib/reports/transform'

type Props = {
  from: string
  to: string
  tab: string
  attendanceRows: AttendanceRow[]
  wfhByDay: WfhByDayRow[]
  wfhPerEmp: WfhPerEmpRow[]
  monFriRows: MonFriRow[]
}

export function ReportsClient({
  from,
  to,
  tab,
  attendanceRows,
  wfhByDay,
  wfhPerEmp,
  monFriRows,
}: Props) {
  const router = useRouter()
  const [fromInput, setFromInput] = useState(from)
  const [toInput, setToInput] = useState(to)

  function navigate(newFrom: string, newTo: string, newTab?: string) {
    const params = new URLSearchParams({
      from: newFrom,
      to: newTo,
      tab: newTab ?? tab,
    })
    router.push(`/reports?${params.toString()}`)
  }

  function applyPreset(preset: 'thisMonth' | 'lastMonth' | 'last30') {
    const today = new Date()
    let newFrom: string
    let newTo: string

    if (preset === 'thisMonth') {
      newFrom = format(startOfMonth(today), 'yyyy-MM-dd')
      newTo = format(today, 'yyyy-MM-dd')
    } else if (preset === 'lastMonth') {
      const last = subMonths(today, 1)
      newFrom = format(startOfMonth(last), 'yyyy-MM-dd')
      newTo = format(endOfMonth(last), 'yyyy-MM-dd')
    } else {
      newFrom = format(subDays(today, 29), 'yyyy-MM-dd')
      newTo = format(today, 'yyyy-MM-dd')
    }

    setFromInput(newFrom)
    setToInput(newTo)
    navigate(newFrom, newTo)
  }

  function handleApply() {
    navigate(fromInput, toInput)
  }

  function handleTabChange(newTab: string) {
    navigate(fromInput, toInput, newTab)
  }

  return (
    <div className="space-y-6">
      {/* Date range bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset('thisMonth')}>
            This Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('lastMonth')}>
            Last Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('last30')}>
            Last 30 Days
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={fromInput}
              onChange={e => setFromInput(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={toInput}
              onChange={e => setToInput(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="wfh">WFH Utilization</TabsTrigger>
          <TabsTrigger value="monday-friday">Mon/Fri Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab rows={attendanceRows} from={from} to={to} />
        </TabsContent>

        <TabsContent value="wfh" className="mt-4">
          <WfhUtilizationTab byDay={wfhByDay} perEmp={wfhPerEmp} from={from} to={to} />
        </TabsContent>

        <TabsContent value="monday-friday" className="mt-4">
          <MondayFridayTab rows={monFriRows} from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/components/reports/reports-client.tsx && git commit -m "feat(reports): add ReportsClient shell with date range bar and tabs"
```

---

## Task 7: Server page component

**Files:**
- Modify: `src/app/(admin)/reports/page.tsx`

- [ ] **Step 1: Replace the stub in `src/app/(admin)/reports/page.tsx`**

```tsx
import { format, startOfMonth } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/reports-client'
import {
  transformAttendance,
  transformWfhByDay,
  transformWfhPerEmployee,
  transformMonFriViolations,
} from '@/lib/reports/transform'

type SearchParams = { from?: string; to?: string; tab?: string }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const today = new Date()
  const from = searchParams.from ?? format(startOfMonth(today), 'yyyy-MM-dd')
  const to = searchParams.to ?? format(today, 'yyyy-MM-dd')
  const tab = searchParams.tab ?? 'attendance'

  const supabase = await createServerSupabaseClient()

  const [
    { data: employees, error: empError },
    { data: records, error: recError },
    { data: wfhSchedules, error: schError },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('compliance_records')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date'),
    supabase
      .from('schedules')
      .select('*')
      .eq('status', 'wfh')
      .gte('date', from)
      .lte('date', to),
  ])

  if (empError ?? recError ?? schError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          Failed to load report data. Please try again.
        </p>
      </div>
    )
  }

  const safeEmployees = employees ?? []
  const safeRecords = records ?? []
  const safeSchedules = wfhSchedules ?? []

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Compliance summaries and WFH usage across the organisation
        </p>
      </div>
      <ReportsClient
        from={from}
        to={to}
        tab={tab}
        attendanceRows={transformAttendance(safeRecords, safeEmployees)}
        wfhByDay={transformWfhByDay(safeSchedules)}
        wfhPerEmp={transformWfhPerEmployee(safeSchedules, safeEmployees, from, to)}
        monFriRows={transformMonFriViolations(safeRecords, safeEmployees)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && git add src/app/"(admin)"/reports/page.tsx && git commit -m "feat(reports): replace page stub with server component"
```

---

## Task 8: Verify

- [ ] **Step 1: Type-check**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run typecheck
```

Expected: No errors. All three queries use `select('*')` so the returned types match `Employee[]`, `ComplianceRecord[]`, and `Schedule[]` exactly — no casting needed.

- [ ] **Step 2: Lint**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run lint
```

Expected: No errors or warnings.

- [ ] **Step 3: Smoke test in browser**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run dev
```

Navigate to `http://localhost:3000/reports` (after logging in as HR admin).

Verify:
1. Default date range = first day of current month → today; Attendance tab active
2. "Last Month" preset fills dates and refetches
3. Switching tabs updates the URL `tab=` param without reloading the page
4. Attendance table renders rows (or empty state if no data)
5. Rate badge is green/amber/red based on value
6. WFH Utilization: Popular Days shows all 5 weekdays; bar widths are proportional
7. Mon/Fri tab shows "No violations" if period is clean
8. Export CSV on each tab downloads a `.csv` file with correct columns

- [ ] **Step 4: Run all tests**

```bash
cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npm run test
```

Expected: All tests pass including the new transform tests.
