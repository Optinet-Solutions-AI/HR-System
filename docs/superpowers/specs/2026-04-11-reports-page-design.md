# Reports Page Design

**Date:** 2026-04-11  
**Scope:** `src/app/(admin)/reports/page.tsx` — three-tab compliance reports page with CSV export

---

## Context

The admin reports page is currently a stub (`TODO: Reports and export functionality`). HR admins need to analyse attendance compliance, WFH usage patterns, and Monday/Friday rule violations without manually querying the database. All underlying data is already computed and stored in `compliance_records` and `schedules` by the daily compliance engine.

---

## Architecture

### Data Fetching

**Approach: Server component fetches all tab data at once based on URL params.**  
Consistent with the existing pattern (calendar, compliance pages). Both queries run in parallel using `Promise.all`.

URL shape: `/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&tab=attendance`  
Defaults: `from` = first day of current month, `to` = today, `tab` = `attendance`.

**Query 1 — compliance_records + employees** (used by Tab 1 & Tab 3)
```
compliance_records
  JOIN employees (first_name, last_name, office_days_per_week)
  WHERE date BETWEEN from AND to
  AND employees.is_active = true
```

**Query 2 — schedules + employees** (used by Tab 2)
```
schedules
  JOIN employees (first_name, last_name)
  WHERE status = 'wfh'
  AND date BETWEEN from AND to
  AND employees.is_active = true
```

Both queries use `createServerSupabaseClient()` (RLS-respecting). HR admin role is already enforced at the layout level.

### Transform Layer

`src/lib/reports/transform.ts` — pure functions; no Supabase imports. Converts raw rows into typed report data used by each tab. Keeps server component thin and keeps logic testable.

```typescript
transformAttendance(records, employees): AttendanceRow[]
transformWfhByDay(schedules): WfhByDayRow[]
transformWfhPerEmployee(schedules, employees): WfhPerEmpRow[]
transformMonFriViolations(records): MonFriRow[]
```

### File Structure

```
src/app/(admin)/reports/
  page.tsx                    ← Server component (replaces stub)

src/components/reports/
  reports-client.tsx          ← "use client" — tabs + date range bar + export dispatch
  attendance-tab.tsx          ← Tab 1: per-employee compliance summary
  wfh-utilization-tab.tsx     ← Tab 2: popular days table + per-employee WFH table
  monday-friday-tab.tsx       ← Tab 3: rule violations table

src/lib/reports/
  transform.ts                ← Pure transform functions
```

---

## Data Types

```typescript
// Tab 1 — Attendance
type AttendanceRow = {
  employee_id: string
  first_name: string
  last_name: string
  total_days: number          // total compliance_records in range
  compliant_days: number
  compliance_rate: number     // 0–100, rounded to 1 dp
  flag_counts: Partial<Record<ComplianceFlag, number>>
  most_common_flag: ComplianceFlag | null
}

// Tab 2 — WFH Utilization
type WfhByDayRow = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
  wfh_count: number
  pct_of_total: number        // 0–100, rounded to 1 dp
}

type WfhPerEmpRow = {
  employee_id: string
  first_name: string
  last_name: string
  wfh_days: number
  total_wfh_entitlement: number   // (5 - office_days_per_week) × working_weeks_in_range
  utilisation_rate: number        // wfh_days / entitlement × 100
}

// Tab 3 — Monday/Friday Analysis
type MonFriRow = {
  employee_id: string
  first_name: string
  last_name: string
  month: string               // "April 2026"
  monday_wfh: number
  friday_wfh: number
  violation_count: number
  violation_dates: string[]   // ISO dates of the violating days
}
```

---

## UI Design

### Date Range Bar (above tabs)

```
[This Month]  [Last Month]  [Last 30 Days]    From: [________]  To: [________]   [Apply]
```

- shadcn `Button` (variant `outline`, `default` when active) for presets
- Native `<input type="date">` for custom from/to
- Pressing a preset fills the inputs and immediately navigates via `router.push`
- Custom: user fills inputs, presses Apply → `router.push`
- Selected tab is preserved across date range changes (kept in URL param)

### Tabs (shadcn `Tabs` component)

Three tabs: **Attendance** | **WFH Utilization** | **Monday/Friday Analysis**

Tab switching updates the `tab` URL param via `router.push` (same from/to preserved).

---

### Tab 1 — Attendance

**Summary cards (2, inline):**
- Overall compliance rate % across all employees and days
- Number of employees with ≥1 non-compliant day

**Table** (TanStack Table, sortable):

| Employee | Total Days | Compliant | Rate | Top Flag |
|---|---|---|---|---|
| Alice Smith | 18 | 16 | 88.9% | missing_clocking |
| Bob Jones | 20 | 20 | 100% | — |

- Rate column: badge coloured green (≥90%), amber (70–89%), red (<70%)
- Top Flag: the most frequent flag for that employee; shown as a `ComplianceFlagBadge` (reuse existing badge from compliance components if one exists, otherwise create inline)
- Export CSV button: top-right of tab panel

**CSV columns:** Employee, Total Days, Compliant Days, Non-Compliant Days, Compliance Rate %, Flags (semicolon-separated with counts, e.g. `missing_clocking×3;wrong_location×1`)

---

### Tab 2 — WFH Utilization

**Section A — Popular Days**

Simple ranked table (no chart library needed):

| Day | WFH Days | % of Total | Bar |
|---|---|---|---|
| Monday | 42 | 28% | ████████░░░░ |

- The "Bar" column is a CSS div with `width: ${pct}%`, capped at 100%. No recharts.
- Always shows all 5 days (Mon–Fri), sorted by WFH count descending.

**Section B — Per Employee**

TanStack Table (sortable):

| Employee | WFH Days | Entitlement | Utilisation |
|---|---|---|---|
| Darren Zahra | 12 | 15 | 80% |

- Entitlement = (5 − office_days_per_week) × working weeks in range (approx: calendar days ÷ 7)
- Employees with `office_days_per_week = 5` are excluded (no WFH entitlement)
- Export CSV button: top-right, covers both sections (two CSV sections separated by blank row)

**CSV structure:**
```
Popular Days
Day,WFH Days,Pct of Total
Monday,42,28
...

Per Employee
Employee,WFH Days,Entitlement,Utilisation Pct
...
```

---

### Tab 3 — Monday/Friday Analysis

**Summary card:** Total violations in period (count of `MonFriRow` entries with `violation_count > 0`)

**Table** (TanStack Table, sortable):

| Employee | Month | Mon WFH | Fri WFH | Violations | Dates |
|---|---|---|---|---|---|
| Alice Smith | April 2026 | 2 | 1 | 2 | Apr 7, Apr 21 |

- Only rows with `violation_count > 0` are shown
- Source: `compliance_records` where `flags` contains `'schedule_mismatch'` AND `date` is a Monday or Friday
- `violation_count` = `violation_dates.length` — each `schedule_mismatch` flag on Mon/Fri is one violation. The first Monday WFH in a month is compliant; the second triggers the flag.
- Dates column: comma-separated short dates (e.g. "Apr 7, Apr 14")
- Export CSV button: top-right of tab

**CSV columns:** Employee, Month, Monday WFH Count, Friday WFH Count, Violation Count, Violation Dates

---

## Export Implementation

Client-side CSV generation via `papaparse` (already installed). No new API routes needed.

```typescript
// Utility in reports-client.tsx (or src/lib/reports/export.ts)
import Papa from 'papaparse'

function downloadCsv(rows: object[], filename: string) {
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

Filenames use the date range: e.g. `attendance_2026-04-01_2026-04-11.csv`.

---

## Verification

1. Run `npm run dev`, navigate to `/reports`
2. Confirm default date range = current month and Attendance tab active
3. Preset buttons: verify "Last Month" sets correct from/to and triggers server refetch
4. Tab switching: verify URL param `tab=` updates without re-fetching data
5. Attendance tab: confirm compliance rate badges colour correctly; sort by Rate column
6. WFH tab: confirm Popular Days bar widths are proportional; per-employee table excludes 5-day-office employees
7. Mon/Fri tab: confirm only violation rows appear; test with a date range known to have violations
8. Export: click each tab's export button, open CSV in a spreadsheet, verify columns and data match the table
9. Run `npm run typecheck` — no errors
10. Run `npm run lint` — no warnings

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/app/(admin)/reports/page.tsx` | Replace stub |
| `src/components/reports/reports-client.tsx` | Create |
| `src/components/reports/attendance-tab.tsx` | Create |
| `src/components/reports/wfh-utilization-tab.tsx` | Create |
| `src/components/reports/monday-friday-tab.tsx` | Create |
| `src/lib/reports/transform.ts` | Create |
