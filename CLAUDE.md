# CLAUDE.md

## Project: WFH Sentinel — Attendance Monitoring & WFH Scheduling System

A web app built on Supabase + Next.js that integrates with Talexio (HR/time-tracking) to automate WFH scheduling, attendance monitoring via GPS geofencing, and compliance reporting. Built for a company in Malta (~15-20 employees).

See `docs/SPEC.md` for the full project specification, data analysis, and architecture rationale.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes (App Router `route.ts` handlers)
- **Database:** Supabase (managed PostgreSQL)
- **Auth:** Supabase Auth (email/password + role-based access via custom claims)
- **Database Client:** Supabase JS SDK (`@supabase/supabase-js`) — no ORM
- **Type Generation:** `supabase gen types typescript` for database types
- **Real-time:** Supabase Realtime (for live dashboard updates)
- **Scheduled Jobs:** Supabase pg_cron (Talexio sync, daily compliance checks) triggering Next.js API routes via HTTP
- **Geofencing:** Turf.js for GPS point-in-radius calculations
- **Row-Level Security:** Supabase RLS policies for data scoping (employee sees own, manager sees team, HR sees all)
- **Deployment:** Vercel (Next.js) + Supabase (database/auth/realtime)

---

## Project Structure

```
wfh-sentinel/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── callback/route.ts          # Supabase auth callback
│   │   ├── (employee)/
│   │   │   └── calendar/page.tsx           # WFH day selection calendar
│   │   ├── (manager)/
│   │   │   └── dashboard/page.tsx          # Team dashboard
│   │   ├── (admin)/
│   │   │   ├── dashboard/page.tsx          # Full org dashboard
│   │   │   ├── employees/page.tsx          # Employee config management
│   │   │   ├── rules/page.tsx              # Schedule rules config
│   │   │   └── reports/page.tsx            # Compliance reports + export
│   │   ├── api/
│   │   │   ├── compliance/
│   │   │   │   ├── run/route.ts            # Trigger compliance check
│   │   │   │   └── override/route.ts       # Manager/HR override a record
│   │   │   ├── schedules/
│   │   │   │   ├── route.ts                # CRUD schedules
│   │   │   │   ├── validate/route.ts       # Dry-run rule validation
│   │   │   │   └── publish/route.ts        # HR locks the month
│   │   │   ├── sync/
│   │   │   │   └── trigger/route.ts        # Manual Talexio sync
│   │   │   ├── reports/
│   │   │   │   └── export/route.ts         # CSV/PDF export
│   │   │   └── cron/
│   │   │       ├── sync-talexio/route.ts   # Called by pg_cron every 15min
│   │   │       └── daily-compliance/route.ts # Called by pg_cron daily
│   │   ├── layout.tsx
│   │   └── page.tsx                        # Redirect based on role
│   ├── components/
│   │   ├── calendar/                       # WFH calendar components
│   │   ├── dashboard/                      # Dashboard widgets, status cards
│   │   ├── compliance/                     # Compliance table, flag badges
│   │   ├── employees/                      # Employee list, config forms
│   │   └── ui/                             # shadcn/ui components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser client (createBrowserClient)
│   │   │   ├── server.ts                   # Server client (createServerClient)
│   │   │   ├── admin.ts                    # Service role client (for cron jobs, bypasses RLS)
│   │   │   └── middleware.ts               # Auth middleware helper
│   │   ├── compliance/
│   │   │   ├── engine.ts                   # Core compliance logic
│   │   │   ├── flags.ts                    # Flag detection functions
│   │   │   └── geofence.ts                 # GPS validation with Turf.js
│   │   ├── talexio/
│   │   │   ├── client.ts                   # Talexio API client
│   │   │   └── sync.ts                     # Sync logic (pull + upsert)
│   │   ├── schedules/
│   │   │   ├── validation.ts               # Rule validation logic
│   │   │   └── rules.ts                    # Rule evaluation functions
│   │   ├── types/
│   │   │   ├── database.ts                 # Auto-generated from `supabase gen types`
│   │   │   └── app.ts                      # App-specific types, enums, constants
│   │   ├── utils.ts                        # General utilities
│   │   └── constants.ts                    # Shared constants, color mappings
│   └── middleware.ts                       # Next.js middleware (auth + role routing)
├── supabase/
│   ├── migrations/                         # SQL migrations
│   ├── seed.sql                            # Initial employee data + office location
│   └── config.toml                         # Supabase local dev config
├── docs/
│   └── SPEC.md                             # Full project specification
├── .env.local                              # Environment variables
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Commands

```bash
# Install dependencies
npm install

# Start Supabase locally (requires Docker)
npx supabase start

# Apply migrations
npx supabase db push

# Generate TypeScript types from database schema
npx supabase gen types typescript --local > src/lib/types/database.ts

# Seed the database
npx supabase db reset    # runs migrations + seed.sql

# Start Next.js dev server
npm run dev

# Run tests
npm run test

# Lint
npm run lint

# Type check
npm run typecheck

# Deploy migrations to production
npx supabase db push --linked

# Generate types from production
npx supabase gen types typescript --linked > src/lib/types/database.ts
```

**After every migration:** always regenerate types with `supabase gen types`. Never manually edit `database.ts`.

---

## Supabase Client Usage

Three clients for different contexts. Using the wrong one causes auth/RLS issues.

```typescript
// BROWSER (client components) — respects RLS, uses session cookie
import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// SERVER (server components, API routes) — respects RLS, reads cookie from request
import { createServerClient } from '@supabase/ssr'
// Use cookies() from next/headers to pass cookie store

// ADMIN (cron jobs, sync, compliance engine) — bypasses RLS, full access
import { createClient } from '@supabase/supabase-js'
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // NEVER expose to client
)
```

**Rules:**
- Browser components → `createBrowserClient` from `src/lib/supabase/client.ts`
- Server components + API routes → `createServerClient` from `src/lib/supabase/server.ts`
- Cron jobs, Talexio sync, compliance engine → admin client from `src/lib/supabase/admin.ts`
- NEVER import admin client in any file under `src/components/` or any `"use client"` file.
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

---

## Database Schema

All tables managed via Supabase migrations in `supabase/migrations/`.

```sql
-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hr_admin', 'super_admin');
CREATE TYPE schedule_status AS ENUM ('office', 'wfh', 'public_holiday', 'vacation', 'sick_leave', 'not_scheduled');
CREATE TYPE actual_status AS ENUM (
  'in_office_confirmed', 'wfh_confirmed', 'no_clocking', 'wrong_location',
  'broken_clocking', 'no_booking', 'vacation', 'public_holiday', 'unknown'
);
CREATE TYPE compliance_flag AS ENUM (
  'missing_clocking', 'missing_clock_out', 'wrong_location', 'no_desk_booking',
  'late_arrival', 'clocking_not_closed', 'schedule_mismatch', 'exceeded_wfh_days'
);

-- ==========================================
-- EMPLOYEES
-- ==========================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  talexio_id TEXT UNIQUE NOT NULL,                    -- e.g., "Daza01", "Esri01"
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  job_schedule TEXT,                                   -- "Full Time 40Hrs"
  unit TEXT,                                           -- "VIP Team JS"
  business_unit TEXT,                                  -- "Sports", "Content"
  office_days_per_week INT NOT NULL DEFAULT 4 CHECK (office_days_per_week BETWEEN 0 AND 5),
  role user_role NOT NULL DEFAULT 'employee',
  team_id UUID REFERENCES teams(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,                                          -- e.g., Salvo's special case
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- TEAMS
-- ==========================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- WFH SCHEDULES
-- ==========================================

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status schedule_status NOT NULL,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_status ON schedules(status);

-- ==========================================
-- CLOCKINGS (synced from Talexio)
-- ==========================================

CREATE TABLE clockings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,                           -- "Monday", "Tuesday", etc.
  time_in TEXT,                                        -- "09:00"
  time_out TEXT,                                       -- "18:00"
  hours_worked DECIMAL(5,2),
  location_in_name TEXT,                               -- "Head Office"
  location_in_lat DECIMAL(10,7),
  location_in_lng DECIMAL(10,7),
  location_out_name TEXT,
  location_out_lat DECIMAL(10,7),
  location_out_lng DECIMAL(10,7),
  clocking_status TEXT DEFAULT 'Active Clocking',      -- "Active Clocking", "Broken clocking"
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_clockings_date ON clockings(date);

-- ==========================================
-- BOOKINGS (desk/room bookings)
-- ==========================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,                                -- "Office", "WFH"
  room TEXT,                                           -- "GCC 2", "Main 5", "Open Plan"
  time_from TEXT,
  time_to TEXT,
  duration TEXT,
  date_booked TIMESTAMPTZ,                             -- when booking was made
  work_location TEXT,                                  -- "Head Office"
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_bookings_date ON bookings(date);

-- ==========================================
-- COMPLIANCE RECORDS
-- ==========================================

CREATE TABLE compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  week_number INT NOT NULL,
  expected_status schedule_status,
  actual_status actual_status NOT NULL,
  has_clocking BOOLEAN NOT NULL DEFAULT false,
  has_booking BOOLEAN NOT NULL DEFAULT false,
  location_match BOOLEAN,                              -- null = unable to determine
  is_compliant BOOLEAN NOT NULL DEFAULT false,
  flags compliance_flag[] DEFAULT '{}',                -- PostgreSQL array of flags
  comment TEXT,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_compliance_date ON compliance_records(date);
CREATE INDEX idx_compliance_compliant ON compliance_records(is_compliant);
CREATE INDEX idx_compliance_week ON compliance_records(week_number);

-- ==========================================
-- SCHEDULE RULES (configurable)
-- ==========================================

CREATE TABLE schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                                  -- "Max WFH per day", "Monday/Friday limit"
  rule_type TEXT NOT NULL,                             -- "MAX_WFH_PER_DAY", "MAX_WFH_PER_DAY_OF_WEEK", etc.
  value JSONB NOT NULL,                                -- { "maxCount": 3 } or { "dayOfWeek": "Monday", "maxPerMonth": 1 }
  applies_to_team_id UUID REFERENCES teams(id),        -- null = global
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- OFFICE LOCATIONS (for geofencing)
-- ==========================================

CREATE TABLE office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                                  -- "Head Office"
  latitude DECIMAL(10,7) NOT NULL,                     -- 35.9222072
  longitude DECIMAL(10,7) NOT NULL,                    -- 14.4878368
  radius_meters INT NOT NULL DEFAULT 200,
  ip_ranges TEXT[] DEFAULT '{}',                       -- optional, for future IP validation
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- PUBLIC HOLIDAYS
-- ==========================================

CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,                                  -- "Good Friday", "Independence Day"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- UPDATED_AT TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Row-Level Security (RLS) Policies

RLS is enabled on all tables. The user's role is stored as a custom claim in Supabase Auth JWT via a `user_role` field on the `employees` table linked to `auth.users`.

```sql
-- Helper function: get current user's employee record
CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user manages a team that includes the target employee
CREATE OR REPLACE FUNCTION is_manager_of(target_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN teams t ON t.id = e.team_id
    WHERE e.id = target_employee_id
    AND t.manager_id = get_my_employee_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SCHEDULES: employees see own, managers see team, HR sees all
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own schedules" ON schedules
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "Managers see team schedules" ON schedules
  FOR SELECT USING (get_my_role() = 'manager' AND is_manager_of(employee_id));

CREATE POLICY "HR sees all schedules" ON schedules
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

CREATE POLICY "Employees insert own schedules" ON schedules
  FOR INSERT WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "HR manages all schedules" ON schedules
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- Apply similar pattern to: clockings, bookings, compliance_records, employees
-- CLOCKINGS and BOOKINGS: read-only for all users (written by sync service via admin client)
-- COMPLIANCE_RECORDS: read for employees (own), managers (team), HR (all). Write only via admin client.
```

**Rules:**
- All user-facing queries go through RLS via browser/server client.
- Cron jobs (sync, compliance) use the admin client to bypass RLS.
- Never disable RLS on a table. If a cron job needs write access, use the service role client.

---

## Auth & Role System

Supabase Auth handles authentication. Roles are managed in the `employees` table, not in Supabase Auth metadata directly.

```typescript
// Middleware: src/middleware.ts
// 1. Refresh session
// 2. Check if user is authenticated
// 3. Query employee record for role
// 4. Redirect based on role:
//    - employee → /calendar
//    - manager → /dashboard (team view)
//    - hr_admin, super_admin → /dashboard (org view)
//    - unauthenticated → /login
```

**Route protection pattern in API routes:**
```typescript
// src/app/api/compliance/run/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role
  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ... run compliance engine using admin client
}
```

---

## Code Style & Conventions

- **TypeScript strict mode** everywhere. No `any` types — use `unknown` and narrow.
- **Zod** for all runtime validation (API inputs, env vars, Talexio API responses).
- **Database types** come from `src/lib/types/database.ts` (auto-generated). App-level types in `src/lib/types/app.ts`.
- **Next.js conventions:** server components by default, `"use client"` only when needed. Use server actions for simple mutations, API routes for complex logic.
- **Naming:** PascalCase for components/classes, camelCase for functions/variables, SCREAMING_SNAKE for constants, kebab-case for file names.
- **Error handling:** Never swallow errors. Use Next.js `error.tsx` boundaries on the frontend. API routes always return proper status codes.
- **No magic strings.** Use typed constants from `src/lib/constants.ts` and `src/lib/types/app.ts`.
- **Supabase queries:** Always check for `error` in the response. Never assume `data` exists.

```typescript
// CORRECT
const { data, error } = await supabase.from('employees').select('*')
if (error) throw new Error(error.message)

// WRONG — will crash silently
const { data } = await supabase.from('employees').select('*')
data.forEach(...)  // data might be null
```

---

## Employee Data — Key Details

Employee names have aliases. Always match on `talexio_id`, never on name:

| Name (Config) | Name (Talexio) | talexio_id | office_days_per_week | Notes |
|---|---|---|---|---|
| Niklas | Niklas Wirth | Niwi01 | 5 | Rarely clocks — often "No clocking" |
| Mohamed | AlJebali Mohamed | Moal01 | 5 | |
| Yassine | Ridene Yassine | Yari01 | 5 | |
| Youssef | Ayedi Youssef | Yoay01 | 5 | |
| Esam | Ridene Esam | Esri01 | 5 | |
| Ada | Svardal Ada | Adsu01 | 4 | |
| Janice | Santangelo Janice | Jasa01 | 4 | |
| Olivier | — | — | 4 | No clocking/booking data. May be inactive. |
| Owen | Ordway Owen | Owor01 | 4 | |
| Redvers | Whitehead Redvers Lewis | Rewh01 | 4 | |
| Salvo/Salvatore | Dolce Salvatore | Sado01 | 4 | "Not sure when/if he will come to office — Alex is aware" |
| Tina | Koepf Tina | Tiko01 | 4 | |
| Darren | Zahra Darren | Daza01 | 2 | |
| Alec | Zanussi Alec | Alza01 | 2 | |
| Christian | Deeken Christian | Chde01 | 1 | Works 5 days/week: 1 office + 4 WFH |

**Critical:** `office_days_per_week` = required days in office, NOT total working days. All employees work 5 days/week. WFH days per week = 5 - office_days_per_week.

---

## Key Architecture Rules

- **Compliance engine is the core.** It lives in `src/lib/compliance/` and orchestrates schedule, clocking, booking, and geofence data. All other modules feed into it.
- **Talexio is the source of truth for clockings.** We sync and store locally but never modify Talexio data. Our tables are a read-cache.
- **Geofence validation uses GPS, not IP.** Office: 35.9222072, 14.4878368 (Malta). Default radius: 200 meters. Configurable via `office_locations` table. IP validation may be added later — pending client clarification.
- **Variable schedules per employee.** `office_days_per_week` ranges 0-5. WFH = 5 - office_days_per_week. Never hardcode "4 office + 1 WFH".
- **Role-based data scoping:** Enforced at two layers — RLS for database queries, middleware for route access. Never rely on only one layer.
- **Schedule rules are configurable**, stored in `schedule_rules` with JSONB `value`. Never hardcode WFH caps or day-of-week constraints.
- **Real-time dashboard** uses Supabase Realtime subscriptions on `clockings` and `compliance_records` tables for live status updates.

---

## Compliance Engine Logic

Lives in `src/lib/compliance/engine.ts`. Triggered daily by pg_cron calling `/api/cron/daily-compliance`. Uses admin client (bypasses RLS).

Produces one `compliance_record` per employee per working day:

1. Skip weekends (Saturday/Sunday) unless employee is explicitly scheduled.
2. Skip public holidays (check `public_holidays` table).
3. Skip employees with approved vacation for that date.
4. Get expected status from `schedules` table.
5. Get actual clocking from `clockings` table (synced from Talexio).
6. Get booking from `bookings` table (if available).
7. Validate GPS location against office geofence using Turf.js (`src/lib/compliance/geofence.ts`).
8. Determine actual status and generate flags.
9. Count weekly WFH days — flag `exceeded_wfh_days` if exceeding (5 - office_days_per_week).
10. Upsert `compliance_record` with `is_compliant` boolean and flags array.

### Monday/Friday WFH Rule
From the client's spreadsheet (rows 32-33): **no employee should have WFH on Monday or Friday more than once per month.** Implement as a `schedule_rule`:
```json
{ "rule_type": "MAX_WFH_PER_DAY_OF_WEEK", "value": { "dayOfWeek": "Monday", "maxPerMonth": 1 } }
{ "rule_type": "MAX_WFH_PER_DAY_OF_WEEK", "value": { "dayOfWeek": "Friday", "maxPerMonth": 1 } }
```
Enforce during WFH day selection (calendar validation) and flag in compliance records.

---

## Talexio Sync

Lives in `src/lib/talexio/`. Triggered every 15 minutes (07:00-20:00 Malta time) by pg_cron calling `/api/cron/sync-talexio`.

```typescript
// src/lib/talexio/sync.ts
// 1. Fetch clockings from Talexio API for current date
// 2. Map Talexio employee IDs to our employee_id (via talexio_id)
// 3. Upsert into clockings table (on conflict employee_id + date)
// 4. Log: records synced, new records, errors
// 5. Handle missing employees gracefully (log warning, don't crash)
```

**Cron security:** API routes under `/api/cron/` check for a `CRON_SECRET` header to prevent unauthorized triggers.

```typescript
// src/app/api/cron/sync-talexio/route.ts
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... run sync with admin client
}
```

---

## API Route Patterns

- All API routes in `src/app/api/`.
- Auth check in every route: get user from Supabase, check role from employees table.
- Pagination: `?page=1&limit=20` → return `{ data, meta: { total, page, limit, totalPages } }`.
- Date ranges: `?from=2026-04-01&to=2026-04-30`.
- Consistent response shape: `{ data }` for success, `{ error, message }` for failures.
- Validate all inputs with Zod before processing.

```typescript
// Pattern for protected API routes
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({ from: z.string().date(), to: z.string().date() })

export async function GET(request: Request) {
  // 1. Auth
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate input
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })

  // 3. Query (RLS automatically scopes data)
  const { data, error } = await supabase
    .from('compliance_records')
    .select('*, employees(first_name, last_name)')
    .gte('date', parsed.data.from)
    .lte('date', parsed.data.to)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}
```

---

## Frontend Patterns

- Dashboard pages use **server components** with data fetched via Supabase server client.
- Calendar component is **client-side** (`"use client"`) — interactive selection with optimistic updates.
- Use **Supabase Realtime** for live dashboard (subscribe to `clockings` and `compliance_records` changes).
- Loading states: use Next.js `loading.tsx` skeletons.
- Toast notifications via shadcn/ui `sonner`.
- Tables use `@tanstack/react-table` with server-side pagination.
- Color coding is consistent everywhere:
  - Office = green (`bg-green-100 text-green-800`)
  - WFH = blue (`bg-blue-100 text-blue-800`)
  - Vacation = yellow (`bg-yellow-100 text-yellow-800`)
  - Public Holiday = gray (`bg-gray-100 text-gray-800`)
  - Violation/Flag = red (`bg-red-100 text-red-800`)
  - No data/Unknown = neutral (`bg-gray-50 text-gray-400`)

### Real-time Dashboard Pattern
```typescript
// src/components/dashboard/live-status.tsx
"use client"
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

export function LiveStatus() {
  const supabase = createBrowserClient()

  useEffect(() => {
    const channel = supabase
      .channel('clockings-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clockings' },
        (payload) => { /* update local state */ }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
```

---

## Testing

- **Unit tests** (Vitest) for: compliance engine logic, geofence calculations, schedule validation rules (including Monday/Friday rule), Zod schemas.
- **Integration tests** for: API routes (use local Supabase instance), Talexio sync logic.
- **E2E tests** (Playwright) for: employee calendar flow, dashboard views, report export.
- Test files live next to source: `engine.ts` → `engine.test.ts`.
- Use factories for test data — don't hardcode employee objects.
- Use Supabase local instance for integration tests: `npx supabase start` provides a test database.

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321       # local dev
NEXT_PUBLIC_SUPABASE_ANON_KEY=                        # from supabase start output
SUPABASE_SERVICE_ROLE_KEY=                            # NEVER expose to client

# Talexio
TALEXIO_API_URL=
TALEXIO_API_KEY=

# Cron security
CRON_SECRET=                                          # shared secret for pg_cron → API route calls

# Geofence defaults
DEFAULT_OFFICE_LAT=35.9222072
DEFAULT_OFFICE_LNG=14.4878368
DEFAULT_GEOFENCE_RADIUS_METERS=200

# Timezone
TZ=Europe/Malta
```

---

## Known Edge Cases to Handle

Real scenarios from the client's existing data:

- **5 office days** (Niklas, Mohamed, etc.) — no WFH selection in calendar.
- **1 office day** (Christian) — works 5 days, 1 office + 4 WFH. Calendar offers 4 WFH slots.
- **2 office days** (Darren, Alec) — calendar offers 3 WFH slots per week.
- **Broken clocking** — punch-in, no punch-out. Flag `missing_clock_out`, don't crash. Daily Reports: "The working day in Talexio was not closed".
- **Wrong GPS on office day** — Redvers Lewis April 7: clocked from 35.887, 14.482 (~3.8km from office). Flag `wrong_location`.
- **Approved vacation** — skip compliance checks entirely. Daily Reports: "Vacation (approved)".
- **Public holidays** — skip all employees. April sheet marks as "PH".
- **Salvo/Salvatore** — uncertain schedule, `notes` field explains situation. Flexible compliance.
- **Niklas** — configured 5 office days but frequently "No clocking". Flag `missing_clocking`, not `wrong_location`.
- **Olivier** — in Config, zero data. Show in employee list but don't generate false violations.
- **Saturday clockings** — some employees work Saturdays. Only check compliance on scheduled days.
- **Office on WFH day** — NOT a violation. Employee chose to come in.
- **No booking** — has clocking but no desk booking. Flag `no_desk_booking`, not `missing_clocking`.
- **Monday/Friday WFH limit** — max 1 Monday or Friday WFH per employee per month (rows 32-33).
- **Tina April 7** — clocked from 35.914, 14.493 (~900m from office), "Broken clocking". Geofence radius must catch this.

---

## What NOT to Do

- Do not hardcode employee schedules. Always read from the database.
- Do not modify Talexio data. We are read-only consumers.
- Do not expose raw GPS coordinates to employees — only show compliance status.
- Do not block punch-ins. The system monitors and reports, it does not prevent clocking.
- Do not skip Zod validation on any external input.
- Do not store secrets in code or logs. Use environment variables.
- Do not match employees by name — always use `talexio_id`. Names have aliases.
- Do not assume all employees clock every day. Handle missing data separately from violations.
- Do not treat `office_days_per_week` as "total working days". All employees work 5 days.
- Do not import `src/lib/supabase/admin.ts` in any client component or `"use client"` file.
- Do not manually edit `src/lib/types/database.ts` — always regenerate from schema.
- Do not disable RLS on any table.

---

## Pending Client Decisions

Default assumptions that may change after client questionnaire:

| Item | Default Assumption | If Changed |
|---|---|---|
| GPS vs IP validation | GPS geofence primary | Add IP check in `geofence.ts` |
| WFH approval flow | Free pick with rule enforcement | Add `pending_approval` status, approval API |
| Max WFH per day cap | No cap (configurable via schedule_rules) | Add capacity check to validation |
| WFH day swaps | Not in MVP | Add swap request/approval flow |
| Dashboard access | HR + Managers (scoped via RLS) | Adjust RLS policies |
| Notification channels | In-app + email (Supabase Auth emails) | Add Slack/Teams webhooks |
| Hot desking integration | Import booking data for cross-ref | Build booking module or integrate with existing |
| Hours tracking | Store from Talexio, not a primary feature | Add hours reports, overtime alerts |
