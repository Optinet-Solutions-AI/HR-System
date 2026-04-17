---
name: Playwright E2E Tests
description: Design spec for Playwright E2E tests covering auth flow, WFH calendar validation, admin dashboard navigation, and report CSV export — using real local Supabase with globalSetup + storageState fixtures
type: project
---

# Playwright E2E Tests — Design Spec

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Add a Playwright E2E test suite covering four critical user flows in WFH Sentinel:

1. Auth flow (login, role-based redirect, middleware guards)
2. WFH calendar selection + validation rejection
3. Admin dashboard navigation
4. Report CSV export

Tests run against a live local dev server (`http://localhost:3000`) and a local Supabase instance (`npx supabase start`). The `@playwright/test` package is already in `devDependencies`.

---

## Test Strategy: globalSetup + per-role storageState

**Chosen approach:** Provision real Supabase test users once before the suite starts, log in via the browser for each role, and save Playwright `storageState` JSON files. All spec files reuse these stored sessions — one login per role, not per test.

- `global-setup.ts` — runs before Playwright starts; creates auth users + employee rows via the Supabase admin client (`SUPABASE_SERVICE_ROLE_KEY`)
- `auth.setup.ts` — a dedicated Playwright project that runs before all spec files; logs in as each test user and writes `e2e/.auth/*.json`
- Spec files declare `use: { storageState: 'e2e/.auth/<role>.json' }` to start pre-authenticated
- `global-teardown.ts` — deletes test users by email via the Supabase admin API

**Why not mocking:** These tests must validate the actual Supabase Auth cookie flow, RLS-scoped data, and Next.js middleware redirects. Mocking would miss that entire layer.

---

## File Structure

```
e2e/
├── playwright.config.ts          # baseURL, two projects (setup + e2e), globalSetup/Teardown
├── global-setup.ts               # Create 3 test users via Supabase admin API
├── global-teardown.ts            # Delete test users by email
├── auth.setup.ts                 # 3 login flows → save storageState JSONs
├── fixtures/
│   └── test-users.ts             # Credentials, email constants
├── auth/
│   └── login.spec.ts             # Auth flow tests (unauthenticated start)
├── calendar/
│   └── wfh-calendar.spec.ts      # WFH selection + validation rejection
├── admin/
│   └── dashboard.spec.ts         # Admin dashboard + sidebar navigation
└── reports/
    └── csv-export.spec.ts        # Report CSV export (UI + API)
```

`e2e/.auth/` is git-ignored (contains live session cookies).

---

## Test User Fixtures

Three users created in `global-setup.ts` and deleted in `global-teardown.ts`:

| Fixture | Email | Role | `office_days_per_week` | Purpose |
|---|---|---|---|---|
| `employee4d` | `e2e.emp4d@test.local` | `employee` | 4 | WFH calendar — 1 WFH/week allowed |
| `employee5d` | `e2e.emp5d@test.local` | `employee` | 5 | Read-only calendar |
| `hradmin` | `e2e.hradmin@test.local` | `hr_admin` | 4 | Admin dashboard + reports |

Passwords are constants in `e2e/fixtures/test-users.ts` (local-only credentials, never used against production). The `talexio_id` values are clearly fake (`E2E_EMP4D`, etc.) so they're unambiguous in the DB.

`global-setup.ts` uses `createAdminSupabaseClient()` to:
1. Call `supabase.auth.admin.createUser()` for each fixture user
2. Insert the matching row into the `employees` table (linked via `auth_user_id`)

`auth.setup.ts` runs three describe blocks — one per role — each navigating to `/login`, filling email/password, waiting for redirect, then calling `page.context().storageState({ path: '...' })`.

---

## Playwright Config: Two Projects

```
projects: [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: 'e2e',
    testMatch: /\.spec\.ts/,
    dependencies: ['setup'],
  },
]
```

`globalSetup` / `globalTeardown` point to `e2e/global-setup.ts` and `e2e/global-teardown.ts`. `baseURL` is `http://localhost:3000`. Spec files use `webServer` to start `npm run dev` automatically (or skip if already running).

---

## Test Cases

### `auth/login.spec.ts` — no storageState, starts unauthenticated

| # | Description | Expected |
|---|---|---|
| 1 | Valid employee credentials | Redirected to `/calendar` |
| 2 | Valid hr_admin credentials | Redirected to `/admin/dashboard` |
| 3 | Wrong password | Toast error visible; stays on `/login` |
| 4 | `GET /calendar` unauthenticated | Middleware redirects to `/login` |
| 5 | `GET /admin/dashboard` unauthenticated | Middleware redirects to `/login` |
| 6 | Employee `GET /admin/dashboard` (authenticated) | Admin layout guard redirects to `/` |

---

### `calendar/wfh-calendar.spec.ts` — two describe blocks

**As `employee4d` (1 WFH/week allowed):**

| # | Description | Expected |
|---|---|---|
| 1 | Calendar renders for next month | Grid visible, month label correct |
| 2 | Click an office day | Day shows "WFH", footer shows "1 unsaved change" |
| 3 | Click WFH day again | Day reverts to "Office", footer shows "No changes" |
| 4 | Select WFH days up to weekly limit, then attempt one more | Toast "Maximum 1 WFH day per week reached"; day stays "Office" |
| 5 | Select 1 Monday WFH, then attempt a 2nd Monday WFH | Toast "Maximum 1 WFH Monday per month reached"; day stays "Office" |
| 6 | Make a change and click Save | Success toast; footer shows "No changes" |

**As `employee5d` (5 office days, read-only):**

| # | Description | Expected |
|---|---|---|
| 7 | Calendar page loads | Read-only banner visible |
| 8 | Day buttons | All have `disabled` attribute |
| 9 | Save/Reset buttons | Not rendered in DOM |

---

### `admin/dashboard.spec.ts` — storageState: `hradmin`

| # | Description | Expected |
|---|---|---|
| 1 | Navigate to `/admin/dashboard` | H1 "Dashboard" visible |
| 2 | Sidebar contains all 6 nav links | Dashboard, Employees, Calendar, Compliance, Rules, Reports |
| 3 | Click "Employees" | URL is `/employees` |
| 4 | Click "Compliance" | URL is `/admin/compliance` |
| 5 | Click "Reports" | URL is `/reports` |
| 6 | Click "Dashboard" | URL is `/admin/dashboard` |

---

### `reports/csv-export.spec.ts` — storageState: `hradmin`

| # | Description | Expected |
|---|---|---|
| 1 | `/reports` renders three tabs | "Attendance", "WFH Utilization", "Monday/Friday Analysis" tabs visible |
| 2 | Click "Export CSV" on Attendance tab | Playwright `Download` event fires; filename matches `attendance_*.csv` |
| 3 | API: `GET /api/reports/export?type=attendance&from=...&to=...&format=csv` with auth | Status 200, `Content-Type: text/csv`, `Content-Disposition: attachment` header |

For test 3, the spec uses `page.request.get(...)` with the authenticated context (cookies from storageState are automatically sent).

---

## Environment Requirements

```env
# Already in .env.local — no additions needed for local runs
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>   # used by global-setup/teardown
```

**Prerequisites before running E2E tests:**

```bash
npx supabase start           # starts local Supabase (Docker required)
npx supabase db reset        # runs migrations + seed.sql
                             # seeds schedule_rules with Monday/Friday WFH limits
                             # (calendar validation tests depend on these rows)
npm run dev                  # or let playwright.config.ts webServer start it
npx playwright test
```

For CI: set the same vars as secrets; run `npx supabase start` and `npx supabase db reset` as steps before `npx playwright test`.

---

## What Is Not Covered

- Talexio sync flows (no Talexio API in local dev)
- Compliance engine execution (unit-tested separately)
- PDF export (CSV is the primary tested format; PDF uses same route)
- Manager role flows (not requested in scope)
- Mobile/responsive layout (add later if needed)
