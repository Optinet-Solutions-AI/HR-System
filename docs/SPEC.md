# SPEC.md — Attendance Monitoring & WFH Scheduling System

## Project Codename: **WFH Sentinel**

---

## 1. PROJECT OVERVIEW

### What We're Building
A companion web application that integrates with **Talexio** (existing HR/time-tracking system) to provide:
1. **WFH Scheduling Engine** — A calendar-based system where employees select their work-from-home days within company-defined rules, replacing the current manual spreadsheet process.
2. **Attendance Monitoring Dashboard** — A real-time dashboard for HR and managers to monitor employee attendance, location compliance, and anomalies.
3. **Automated Compliance Reporting** — Replacing the manually-built "Daily Reports" spreadsheet with automated cross-referencing of bookings vs. clockings.

### Who It's For
- **Employees** — Select their WFH day(s) via a self-service calendar.
- **Managers** — View their team's attendance, approve/review WFH requests (if approval flow is required — *pending client confirmation*).
- **HR / Admin** — Full dashboard access, compliance reports, configuration of rules and schedules, override capabilities.

### Current State (What Exists Today)
- **Talexio** handles punch in/out and records location data (GPS coordinates: latitude/longitude) per clocking event.
- A **Google Sheets workbook** with 5 tabs is used to manually manage everything:
  - `April` — Monthly calendar matrix (employees × dates) showing Office/WFH/PH/Vacation status. Includes validation rules (rows 32-33) checking if any employee has more than 1 Monday or Friday as WFH per month.
  - `Bookings` — Room/desk booking records (hot desking system) with employee, date, status, room, time from/to, duration, date booked, and work location.
  - `Config` — Employee list with their required Office Days/Week (ranges from 1 to 5). Includes notes for special cases.
  - `Clockings` — Raw Talexio export with employee code, names, GPS coordinates (in/out), timestamps, hours worked, job schedule, unit, and business unit.
  - `Daily Reports` — Manually compiled weekly compliance audit cross-referencing bookings vs. clockings, with flagged anomalies and human-written comments.

---

## 2. CRITICAL DATA FINDINGS

### 2.1 Location Tracking: GPS vs. IP
**Client stated:** Validation should use office IP address.
**Data shows:** Talexio records GPS coordinates (e.g., 35.9222072, 14.4878368 — Malta), not IP addresses.

**⚠️ PENDING CLIENT CLARIFICATION:**
> "Your Talexio clockings data currently records GPS coordinates (latitude/longitude) for each punch-in, not IP addresses. When you mentioned IP-based validation, did you mean using the GPS location data that Talexio already captures, or do you specifically need IP address validation as a separate check? Or both?"

**Architecture Decision:** Build GPS geofence validation as the primary method since data already exists. IP validation can be added as an optional secondary check via the `ip_ranges` field on `office_locations`.

### 2.2 Variable Office Schedules
The brief implied a uniform "4 office + 1 WFH" rule. **The Config data shows otherwise:**

| Office Days/Week | Employees | WFH Days/Week |
|---|---|---|
| 5 (full office) | Niklas, Mohamed, Yassine, Youssef, Esam | 0 |
| 4 | Ada, Janice, Olivier, Owen, Redvers, Salvo, Tina | 1 |
| 2 | Darren, Alec | 3 |
| 1 | Christian | 4 |

**Critical clarification:** `office_days_per_week` means "required days in the office", NOT "total working days". All employees work 5 days per week. WFH days = 5 - office_days_per_week.

**Note on Salvo/Salvatore:** "Not sure when and if he will come to the office — Alex is aware." The system must handle uncertain/flexible schedules via the `notes` field.

**Note on Olivier:** Listed in Config (4 office days) but has zero entries in Bookings or Clockings. May be inactive or not yet started.

**Note on Niklas:** Configured for 5 office days but frequently shows "No clocking" in Daily Reports. System must distinguish missing data from violations.

### 2.3 Employee Name Aliases
Employee names differ between systems. Always match on `talexio_id`, never on name:

| Name (Config) | Name (Talexio) | talexio_id |
|---|---|---|
| Niklas | Niklas Wirth | Niwi01 |
| Mohamed | AlJebali Mohamed | Moal01 |
| Yassine | Ridene Yassine | Yari01 |
| Youssef | Ayedi Youssef | Yoay01 |
| Esam | Ridene Esam | Esri01 |
| Ada | Svardal Ada | Adsu01 |
| Janice | Santangelo Janice | Jasa01 |
| Olivier | — | — |
| Owen | Ordway Owen | Owor01 |
| Redvers | Whitehead Redvers Lewis | Rewh01 |
| Salvo/Salvatore | Dolce Salvatore | Sado01 |
| Tina | Koepf Tina | Tiko01 |
| Darren | Zahra Darren | Daza01 |
| Alec | Zanussi Alec | Alza01 |
| Christian | Deeken Christian | Chde01 |

### 2.4 Hot Desking / Room Booking Integration
The Bookings sheet shows an existing room/desk booking system with rooms like: GCC 1-5, Main 1-7, Open Plan, WFH. The Daily Reports reference "Hot Desking" for compliance checks (e.g., "Supposed to be in the office according to Hot Desking", "No booking in Hot Desking").

**⚠️ PENDING CLIENT CLARIFICATION:**
> Is the room booking system something we need to integrate with, replace, or is it out of scope?

**Architecture Decision:** Treat bookings as a data source. Import booking data to cross-reference against clockings for compliance.

### 2.5 Monday/Friday WFH Rule
The April sheet (rows 32-33) includes validation checks: "More than 1 Monday" and "More than 1 Friday" per employee per month, with TRUE/FALSE flags. This is a specific business rule that must be enforced in the scheduling calendar and flagged in compliance.

### 2.6 Edge Cases from Daily Reports
The manual Daily Reports reveal real-world scenarios the system must handle:

| Scenario | Example from Data | System Must Handle |
|---|---|---|
| No clocking | Employee didn't punch in/out at all | Flag as missing attendance |
| Not from the office | GPS coordinates don't match office location | Flag as location violation |
| Broken clocking | Punch-in exists but no punch-out, or Talexio didn't close the day | Flag for manual review |
| Vacation (approved) | Employee on approved leave | Exclude from compliance checks |
| No booking in Hot Desking | Employee clocked in but has no desk booking | Flag as booking violation |
| Wrong location vs. booking | "Supposed to be in the office according to Hot Desking" | Flag as schedule mismatch |
| Unknown status | No clocking + no booking + no leave | Flag for investigation |
| Saturday work | Some employees clock on Saturdays | Only check compliance on scheduled days |

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js on Vercel)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Employee  │  │   Manager    │  │    HR      │  │  Reports  │  │
│  │ Calendar  │  │  Dashboard   │  │  Admin     │  │  Export   │  │
│  └──────────┘  └──────────────┘  └───────────┘  └───────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js API Routes                           │   │
│  │  /api/compliance/*  /api/schedules/*  /api/cron/*         │   │
│  │  /api/sync/*        /api/reports/*    /api/config/*       │   │
│  └──────────────────────────────┬───────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────┐
│                          SUPABASE                                │
│  ┌──────────────┐  ┌───────────┴──┐  ┌────────────────────────┐ │
│  │  Supabase     │  │  PostgreSQL  │  │  Supabase Realtime     │ │
│  │  Auth         │  │  + RLS       │  │  (live dashboard)      │ │
│  └──────────────┘  │  + pg_cron   │  └────────────────────────┘ │
│                     └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │       Talexio API           │
                    │  (clockings, GPS, employee) │
                    └────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR for dashboard, React ecosystem, API routes eliminate need for separate backend |
| **UI Library** | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system, accessible |
| **Database** | Supabase (managed PostgreSQL) | Managed DB, built-in auth, realtime subscriptions, RLS, pg_cron — eliminates 3 separate services |
| **Auth** | Supabase Auth | Email/password, role-based access via RLS, session management built-in |
| **Database Client** | Supabase JS SDK | Auto-generated TypeScript types, native RLS support, no ORM overhead |
| **Real-time** | Supabase Realtime | Live dashboard updates via PostgreSQL change subscriptions |
| **Scheduling** | pg_cron (via Supabase) | Cron triggers calling Next.js API routes — no Redis or BullMQ needed |
| **Maps/Geo** | Turf.js | Lightweight geofence calculation, no external API needed |
| **Deployment** | Vercel (Next.js) + Supabase (DB/Auth) | Two managed services, zero infrastructure to maintain |
| **CI/CD** | GitHub Actions | Automated testing, linting, Supabase migrations |

### 3.3 Key Technical Decisions

**Why Supabase over self-hosted PostgreSQL + NestJS + Redis?**
For ~15-20 employees, running a separate backend, database, cache, and job queue is over-engineering. Supabase gives us PostgreSQL, auth, realtime, row-level security, and cron jobs in a single managed service. Next.js API routes handle the compliance engine and Talexio sync — that's where the complex business logic lives. Total infrastructure: 2 services instead of 4+.

**Why Supabase JS client over Prisma?**
Prisma adds a code generation step, migration management layer, and ORM abstraction that isn't needed here. Supabase's JS client works natively with RLS policies (Prisma bypasses them), and `supabase gen types` gives us TypeScript types directly from the database schema.

**Why Next.js API routes for business logic instead of Edge Functions or database functions?**
The compliance engine has complex branching logic with multiple data source cross-references, geofence calculations, and configurable rules. This is easier to write, test, and debug in TypeScript files (`src/lib/compliance/engine.ts`) than in SQL functions or Deno-based Edge Functions. API routes run on Node.js with full npm ecosystem access.

**Why Supabase Realtime for the dashboard?**
The monitoring dashboard needs near-real-time updates when clockings come in or compliance records change. Supabase Realtime subscribes to PostgreSQL changes via WebSocket — no polling, no extra infrastructure.

---

## 4. DATA MODEL

All tables managed via SQL migrations in `supabase/migrations/`. Types auto-generated via `supabase gen types typescript`.

### 4.1 Enums

```sql
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
```

### 4.2 Core Tables

**employees** — Linked to Supabase Auth via `auth_user_id`. Talexio identity via `talexio_id`.
- `office_days_per_week` (1-5) — required office days. WFH = 5 minus this.
- `role` — controls RLS visibility and UI routing.
- `notes` — free text for special cases (e.g., Salvo).

**teams** — Simple grouping with a manager reference. Used for RLS scoping (managers see their team).

**schedules** — One entry per employee per date. Status: office, wfh, public_holiday, vacation, sick_leave, not_scheduled. Unique on (employee_id, date).

**clockings** — Synced from Talexio. GPS coordinates for in/out locations, timestamps, hours worked. Unique on (employee_id, date). Written only by admin client (sync service).

**bookings** — Desk/room booking data. Status, room assignment, times. Unique on (employee_id, date). Written only by admin client (sync/import).

**compliance_records** — Output of the compliance engine. One per employee per working day. Contains expected vs actual status, flags array, compliance boolean, review/override fields. Unique on (employee_id, date).

**schedule_rules** — Configurable rules with JSONB value field. Types: MAX_WFH_PER_DAY, MAX_WFH_PER_DAY_OF_WEEK, MIN_OFFICE_PER_TEAM. Can be global or team-specific.

**office_locations** — GPS coordinates + geofence radius. Supports optional IP ranges for future IP validation. Currently one location: Head Office, Malta (35.9222072, 14.4878368).

**public_holidays** — Date + name. Used by compliance engine and calendar to skip checks and block WFH selection.

Full SQL schema is in the `CLAUDE.md` file and in `supabase/migrations/`.

---

## 5. CORE FEATURES — MVP

### 5.1 WFH Calendar (Employee View)
- Monthly calendar view showing all working days.
- Employee selects their WFH day(s) for the upcoming month based on their `office_days_per_week` config.
- Calendar enforces rules:
  - Cannot exceed allowed WFH days per week (5 - office_days_per_week).
  - Respects public holidays (grayed out, not selectable).
  - Monday/Friday WFH limit — max 1 Monday and 1 Friday per month (from client's existing validation).
  - Configurable rules from `schedule_rules` table.
- Employees with `office_days_per_week = 5` see the calendar in read-only mode (no WFH slots).
- Visual indicators: Office (green), WFH (blue), PH (gray), Vacation (yellow), Not Scheduled (empty).
- Deadline enforcement: selections must be made by cutoff date (1 week before month starts).
- **PENDING:** Whether selection is free-pick or requires manager approval.

### 5.2 Monitoring Dashboard (Manager/HR View)
- **Today's Overview:** Live status of all employees via Supabase Realtime — In Office, WFH, Not Yet Punched In, On Leave, Anomaly.
- **Weekly Compliance View:** Replaces the manual Daily Reports sheet. Auto-generated, showing expected vs. actual for each employee per day.
- **Flags & Alerts:** Highlighted rows for violations — wrong location, missing clocking, broken clocking, no booking.
- **Summary Stats:** Compliance rate, WFH utilization, anomaly count, office occupancy.
- **Filters:** By team, by employee, by date range, by compliance status.
- Role-based visibility enforced via Supabase RLS: managers see their team, HR sees everyone.

### 5.3 Compliance Engine
- Lives in `src/lib/compliance/engine.ts`.
- Triggered daily by pg_cron calling `/api/cron/daily-compliance`.
- Uses admin Supabase client (bypasses RLS for full data access).
- Pulls latest clockings, schedules, bookings, and office locations.
- Produces one `compliance_record` per employee per working day.
- See Section 8 for detailed logic flow.

### 5.4 Talexio Sync Service
- Lives in `src/lib/talexio/`.
- Triggered every 15 minutes (07:00-20:00 Malta time) by pg_cron calling `/api/cron/sync-talexio`.
- Pulls clockings via Talexio REST API.
- Maps Talexio employee IDs to internal `employee_id` via `talexio_id`.
- Upserts into `clockings` table.
- Handles: new employees, missing data, API errors with retry.
- Employees in Config but missing from Talexio (e.g., Olivier) are logged as warnings, not errors.

### 5.5 Employee Configuration (HR Admin)
- Manage employee list (synced from Talexio, with manual overrides).
- Set `office_days_per_week` per employee.
- Set special notes (e.g., Salvo's uncertain schedule).
- Define teams and assign managers.
- Configure office locations (GPS coordinates + geofence radius + optional IP ranges).
- Set scheduling rules (max WFH per day, Monday/Friday limits, min office staff).

### 5.6 Reporting & Export
- Weekly compliance summary (replaces Daily Reports sheet).
- Monthly attendance report per employee.
- WFH utilization report (which days are most popular, trends over time).
- Export to CSV and PDF.
- Monday/Friday WFH analysis (from April sheet rows 32-33 logic).

---

## 6. FEATURES — POST-MVP (v1.1+)

| Feature | Priority | Notes |
|---|---|---|
| WFH day swap requests | High | Employee-initiated, manager-approved |
| Auto-schedule suggestion | High | System suggests optimal WFH distribution based on rules |
| Slack/Teams notifications | Medium | Daily reminders, violation alerts |
| Mobile-responsive PWA | Medium | For on-the-go access |
| Real-time office occupancy view | Medium | Live count of who's in office |
| Calendar invites (Google/Outlook) | Medium | Auto-create calendar events for WFH days |
| Hours worked reporting | Medium | Track and report on total hours from Talexio data |
| IP-based validation | Low | Secondary check alongside GPS geofencing |
| Payroll integration | Low | Export attendance data for payroll processing |
| Historical trend analytics | Low | AI-powered insights on attendance patterns |

---

## 7. API DESIGN

All API routes are Next.js App Router route handlers in `src/app/api/`.

### 7.1 Core Endpoints

```
# Auth (handled by Supabase — no custom routes needed)
# Login/logout/session via Supabase Auth client

# Schedules (WFH Calendar)
GET    /api/schedules                    # get schedules for month/team (RLS-scoped)
POST   /api/schedules                    # employee submits WFH selections
PATCH  /api/schedules/[id]              # update a schedule entry
POST   /api/schedules/validate          # dry-run: check if selections comply with rules
POST   /api/schedules/publish           # HR publishes/locks the month's schedule

# Compliance
GET    /api/compliance                   # list compliance records (RLS-scoped)
GET    /api/compliance/summary           # aggregated stats for dashboard
POST   /api/compliance/[id]/override    # manager/HR overrides a flagged record
POST   /api/compliance/run              # trigger compliance check manually (HR only)

# Employees (HR Admin)
# Most reads go directly via Supabase client (RLS-scoped)
PATCH  /api/employees/[id]              # update config (office_days_per_week, notes, role)

# Reports
GET    /api/reports/attendance           # attendance report (date range, team)
GET    /api/reports/wfh-utilization      # WFH usage stats
GET    /api/reports/export               # CSV/PDF export

# Config (HR Admin)
GET    /api/config/office-locations      # list office locations
POST   /api/config/office-locations      # add/update office location
GET    /api/config/schedule-rules        # list scheduling rules
POST   /api/config/schedule-rules        # add/update rules

# Sync (HR Admin + cron)
POST   /api/sync/trigger                 # manual sync trigger
GET    /api/sync/status                  # last sync status, errors

# Cron (secured with CRON_SECRET header)
POST   /api/cron/sync-talexio           # called by pg_cron every 15min
POST   /api/cron/daily-compliance       # called by pg_cron daily
```

### 7.2 API Design Notes

- **Many reads go directly through the Supabase client** (no API route needed) — RLS handles authorization. API routes are only for complex operations (compliance engine, sync, report generation, schedule validation).
- All API routes validate auth via `supabase.auth.getUser()` and check role from `employees` table.
- Cron routes validate `CRON_SECRET` header instead of user auth.
- Input validation via Zod schemas.
- Consistent response shape: `{ data }` for success, `{ error, message }` for failures.

---

## 8. COMPLIANCE ENGINE LOGIC

This is the heart of the system — replacing the manual Daily Reports process.

```
FOR each active employee FOR each working day in the period:

1. SKIP if date is Saturday/Sunday (unless employee has an explicit schedule entry)
2. SKIP if date is in public_holidays table → mark PUBLIC_HOLIDAY
3. SKIP if employee has approved vacation for this date → mark VACATION

4. GET expected_status from schedules table
   - If no schedule entry → flag as NOT_SCHEDULED / UNKNOWN

5. GET clocking from clockings table (synced from Talexio)
   - If no clocking → flag MISSING_CLOCKING
   - If clocking has time_in but no time_out → flag MISSING_CLOCK_OUT / CLOCKING_NOT_CLOSED

6. GET booking from bookings table (if data available)
   - If expected_status = OFFICE and no booking → flag NO_DESK_BOOKING

7. VALIDATE location (if clocking exists):
   a. Calculate distance between clocking GPS and office location using Turf.js
   b. If expected_status = OFFICE:
      - GPS within geofence → IN_OFFICE_CONFIRMED
      - GPS outside geofence → flag WRONG_LOCATION
   c. If expected_status = WFH:
      - GPS outside geofence → WFH_CONFIRMED
      - GPS inside geofence → fine (they came to office on WFH day — not a violation)

8. VALIDATE schedule compliance:
   - Count WFH days this week for the employee
   - If count > allowed (5 - office_days_per_week) → flag EXCEEDED_WFH_DAYS
   - Count WFH Mondays this month → if > 1, flag
   - Count WFH Fridays this month → if > 1, flag

9. HANDLE special cases:
   - Employee with no Talexio data at all (e.g., Olivier) → mark UNKNOWN with comment, not violation
   - Employee who frequently has no clockings (e.g., Niklas) → flag MISSING_CLOCKING consistently

10. SET is_compliant:
    - true if no flags
    - false if any flag exists

11. UPSERT compliance_record (on conflict: employee_id + date)
```

---

## 9. GEOFENCE VALIDATION

### Office Location (from data)
- **Head Office coordinates:** 35.9222072, 14.4878368 (Malta)
- **Default geofence radius:** 200 meters (configurable per office location)

### Validation Logic
```typescript
import * as turf from '@turf/turf';

function isWithinOffice(
  clockingLat: number,
  clockingLng: number,
  officeLat: number,
  officeLng: number,
  radiusMeters: number
): boolean {
  const from = turf.point([clockingLng, clockingLat]);
  const to = turf.point([officeLng, officeLat]);
  const distance = turf.distance(from, to, { units: 'meters' });
  return distance <= radiusMeters;
}
```

### Known Edge Cases from Real Data
- **Redvers Lewis** on April 7: clocked from 35.88758842, 14.48299381 — ~3.8km from office. Flagged "Not from the office" in Daily Reports. ✅ System correctly flags.
- **Tina** on April 7: clocked from 35.9145984, 14.4935334 — ~900m from office. Flagged "Broken clocking". ✅ System flags as outside 200m geofence.
- **Owen** on April 6: clocked from 35.9222072, 14.4878368 (exact office coordinates). Clock-out from different coords (35.9222072, 14.4878368). ✅ System confirms office attendance.
- **Darren** on April 7: clocked from 35.9222072, 14.4878368 (office) but clock-out from 35.84552877, 14.52029529 (~8km away). Flagged "Not from the office". The system should validate **clock-in** location as primary.

---

## 10. ROW-LEVEL SECURITY

Supabase RLS policies enforce data scoping at the database level:

- **Employees** see only their own schedules, clockings, and compliance records.
- **Managers** see their own data + all data for employees on their team.
- **HR Admin / Super Admin** see all data across the organization.

RLS is enforced automatically when using the browser or server Supabase client. The admin client (service role) bypasses RLS and is used only for cron jobs, sync, and the compliance engine.

Helper functions in PostgreSQL:
- `get_my_employee_id()` — returns the employee ID for the current authenticated user.
- `get_my_role()` — returns the role for the current authenticated user.
- `is_manager_of(target_employee_id)` — returns true if the current user manages the team containing the target employee.

---

## 11. PENDING CLIENT CLARIFICATIONS

The architecture is designed to accommodate any answer to these questions:

| # | Question | Default Assumption | Impact if Changed |
|---|---|---|---|
| 1 | GPS vs IP validation? | GPS geofence is primary | Add IP validation in geofence module |
| 2 | WFH selection: free pick or approval required? | Free pick with rule enforcement | Add pending_approval status, approval endpoints |
| 3 | Max WFH employees per day? | No cap (configurable via schedule_rules) | Add capacity check to calendar validation |
| 4 | Can employees swap WFH days post-publish? | No swaps in MVP | Add swap request/approval flow |
| 5 | Any roles excluded from WFH? | Handled via office_days_per_week = 5 | Already covered |
| 6 | What happens on wrong-location punch? | Flag for review (not blocked) | System monitors, doesn't prevent |
| 7 | How many office locations? | Single office (Head Office, Malta) | Add multi-location geofence |
| 8 | Dashboard access: HR only vs managers too? | HR + Managers (scoped via RLS) | Adjust RLS policies |
| 9 | Manager sees own team only or all? | Own team only (RLS enforced) | Adjust RLS policies |
| 10 | Real-time dashboard or periodic? | Real-time via Supabase Realtime | Already built in |
| 11 | Notification channels? | In-app + email (Supabase Auth emails) | Add Slack/Teams webhooks |
| 12 | How many employees? | ~15-20 (based on current data) | Supabase handles scaling |
| 13 | Target go-live date? | TBD | Impacts sprint planning |
| 14 | Hot desking integration scope? | Import booking data for cross-ref | Build booking module or API integration |
| 15 | Hours tracking needed? | Store from Talexio, not primary feature | Add hours/overtime reports |

---

## 12. DEVELOPMENT PHASES

### Phase 1: Foundation (Week 1-2)
- [ ] Supabase project setup (local + production)
- [ ] Database schema (migrations + seed data)
- [ ] Next.js project scaffolding with App Router
- [ ] Supabase Auth integration (login, session, middleware)
- [ ] RLS policies for all tables
- [ ] Employee management (CRUD + config page)
- [ ] Office location config + geofence validation logic (Turf.js)
- [ ] Type generation pipeline (`supabase gen types`)

### Phase 2: WFH Calendar (Week 3-4)
- [ ] Employee calendar view — monthly grid component
- [ ] WFH day selection with rule validation
- [ ] Monday/Friday limit enforcement
- [ ] Schedule publishing workflow (HR locks the month)
- [ ] Per-employee office days configuration
- [ ] Public holiday + vacation integration
- [ ] Read-only mode for employees with 5 office days

### Phase 3: Talexio Sync + Compliance Engine (Week 4-5)
- [ ] Talexio API client + sync logic
- [ ] pg_cron setup for 15-minute sync
- [ ] Cron route security (CRON_SECRET)
- [ ] Compliance engine core logic
- [ ] Flag generation for all compliance_flag types
- [ ] Daily compliance cron job
- [ ] Override/review workflow for managers and HR

### Phase 4: Dashboard (Week 5-6)
- [ ] Today's live status view with Supabase Realtime
- [ ] Weekly compliance table (replacing Daily Reports sheet)
- [ ] Monthly overview calendar (replacing April sheet)
- [ ] Filters: by team, employee, date, compliance status
- [ ] Summary stats: compliance rate, WFH utilization, anomaly count
- [ ] Role-based views (manager team view vs HR org view)

### Phase 5: Reporting & Polish (Week 7-8)
- [ ] CSV + PDF export
- [ ] Attendance report
- [ ] WFH utilization report
- [ ] Monday/Friday WFH analysis
- [ ] Notification system (in-app + email)
- [ ] UI polish, responsive design, error handling
- [ ] Testing: unit (Vitest), integration, e2e (Playwright)

### Phase 6: Launch (Week 8-9)
- [ ] Supabase production setup + environment config
- [ ] Vercel deployment
- [ ] Data migration (import current Config + historical data via seed)
- [ ] Staging UAT with client
- [ ] Production deployment
- [ ] Monitoring + alerting setup
- [ ] Client training / documentation

---

## 13. ENVIRONMENT SETUP

### Prerequisites
```bash
node >= 20.x
npm >= 10.x
docker >= 24.x          # for Supabase local
supabase CLI             # npm install -g supabase
```

### Local Development
```bash
# Clone and install
git clone <repo-url>
cd wfh-sentinel
npm install

# Start Supabase locally
npx supabase start

# Apply migrations + seed
npx supabase db reset

# Generate types
npx supabase gen types typescript --local > src/lib/types/database.ts

# Start Next.js
npm run dev
```

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>    # NEVER expose to client

# Talexio
TALEXIO_API_URL=
TALEXIO_API_KEY=

# Cron security
CRON_SECRET=<generated shared secret>

# Geofence defaults
DEFAULT_OFFICE_LAT=35.9222072
DEFAULT_OFFICE_LNG=14.4878368
DEFAULT_GEOFENCE_RADIUS_METERS=200

# Timezone
TZ=Europe/Malta
```

---

## 14. TESTING STRATEGY

| Type | Tool | Coverage Target |
|---|---|---|
| Unit | Vitest | Compliance engine logic, geofence calculations, schedule validation rules |
| Integration | Vitest + local Supabase | API routes, database operations, Talexio sync |
| E2E | Playwright | Employee calendar flow, dashboard views, report generation |
| Manual QA | Checklist | Edge cases from Daily Reports data |

### Critical Test Cases (from real data)
1. Employee with 5 office days (Niklas) — should not see WFH option in calendar.
2. Employee with 1 office day (Christian) — should be able to pick 4 WFH days per week.
3. Employee with 2 office days (Darren, Alec) — should be able to pick 3 WFH days per week.
4. Broken clocking (no punch-out) — should flag `missing_clock_out`, not crash.
5. Employee clocking from non-office GPS on office day — should flag `wrong_location`.
6. Employee on approved vacation — should skip compliance check entirely.
7. Public holiday — all employees excluded from compliance.
8. Salvo/Salvatore — uncertain schedule handled via notes field, flexible compliance.
9. Olivier — in config but no data. Show in employee list, don't generate false violations.
10. Niklas — 5 office days but frequently no clocking. Flag `missing_clocking`, not `wrong_location`.
11. Month boundary — schedule selections spanning week boundaries handled correctly.
12. Saturday clockings — compliance only runs for scheduled working days.
13. Employee at office on WFH day — NOT a violation.
14. Monday/Friday WFH limit — max 1 per month per employee, enforced in calendar + compliance.
15. Geofence accuracy — Tina's 900m distance must be caught by 200m radius.

---

## 15. SECURITY CONSIDERATIONS

- **Authentication:** Supabase Auth with email/password. Session managed via cookies (createServerClient).
- **Authorization:** Two layers — RLS at database level + role check in API routes. Never rely on only one.
- **Data privacy:** GPS coordinates are sensitive. RLS prevents employees from seeing others' location data. Only compliance status (compliant/flagged) visible to employees for their own records.
- **Service role key:** Only used in server-side cron jobs and the compliance engine. Never imported in client components. Never logged.
- **Cron security:** API routes under `/api/cron/` validate a `CRON_SECRET` bearer token.
- **Input validation:** All API inputs validated with Zod before processing.
- **Talexio API key:** Stored as environment variable, never in code or logs.
- **GDPR considerations:** Employee location tracking requires clear policy. System should support data export and deletion requests. ⚠️ *PENDING: Client to confirm local data privacy requirements (Malta falls under EU GDPR).*

---

## 16. SUCCESS METRICS

| Metric | Target | How We Measure |
|---|---|---|
| Manual report creation time saved | 90% reduction | Currently hours/week → should be zero |
| Schedule creation time | < 5 minutes per month (HR) | Time from open calendar to publish |
| Compliance check accuracy | 99%+ | Compare automated flags vs. manual audit for first month |
| Employee self-service adoption | 100% within 2 months | All eligible employees using the calendar |
| Dashboard load time | < 2 seconds | Lighthouse + real user monitoring |
| Talexio sync reliability | 99.9% uptime | Supabase logs + custom alerting |
| Real-time dashboard latency | < 5 seconds | Time from Talexio sync to dashboard update |
