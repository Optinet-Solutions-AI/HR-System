# Public Holidays CRUD — Design Spec

**Date:** 2026-04-10  
**Feature:** Add/delete public holidays from the admin rules page, with a one-click Malta 2026 seed.

---

## Context

The `public_holidays` table already exists in the schema. The compliance engine skips all employees on public holidays. Malta 2026 holidays are defined in `seed.sql` (runs on `db reset`), but production databases that aren't reset have no holidays — hence the need for a UI seed action.

The `src/app/(admin)/rules/page.tsx` is currently an empty shell with a TODO comment.

---

## Architecture

Follows the existing employees feature pattern exactly:

```
Server Component (page.tsx)
  └─ fetches holidays via server Supabase client
  └─ passes data to HolidaysPanel (client component)
      └─ mutations → fetch('/api/holidays/...') → router.refresh() + toast
```

---

## Files

| File | Action | Purpose |
|---|---|---|
| `src/app/(admin)/rules/page.tsx` | Modify | Server component — fetch + render |
| `src/components/holidays/holidays-panel.tsx` | Create | Client component — full UI |
| `src/app/api/holidays/route.ts` | Create | GET list + POST add |
| `src/app/api/holidays/[id]/route.ts` | Create | DELETE by id |
| `src/app/api/holidays/seed/route.ts` | Create | POST seed Malta 2026 |

---

## API Routes

All routes: auth check (server client) → role must be `hr_admin` or `super_admin` → 403 otherwise.

### `GET /api/holidays`
- Returns `{ data: PublicHoliday[] }` ordered by date asc.
- Used for initial page load only (server component fetches directly — this route exists for completeness).

### `POST /api/holidays`
- Body: `{ date: string, name: string }` — Zod-validated.
- `date` must be `z.string().date()` (YYYY-MM-DD format).
- `name` must be non-empty string.
- Inserts single row. Returns 409 if date already exists (Supabase unique constraint on `date`).

### `DELETE /api/holidays/[id]`
- Deletes by UUID. Returns 404 if not found.

### `POST /api/holidays/seed`
- Hardcoded Malta 2026 list (14 holidays).
- Bulk insert with `ON CONFLICT (date) DO NOTHING` — idempotent, safe to re-run.
- Returns `{ data: { inserted: number } }` — count of actually-inserted rows.

---

## UI Component — `HolidaysPanel`

```
[ Public Holidays ]                    [ Seed Malta 2026 defaults ]

[ Date input        ] [ Name input              ] [ Add ]

┌─────────────┬────────────────────────────────┬──────┐
│ Date        │ Name                           │      │
├─────────────┼────────────────────────────────┼──────┤
│ 2026-01-01  │ New Year's Day                 │  🗑  │
│ 2026-02-10  │ Feast of St Paul's Shipwreck   │  🗑  │
│ ...         │ ...                            │  🗑  │
└─────────────┴────────────────────────────────┴──────┘
```

- **Date input:** native `<input type="date">` — no Popover component available in project.
- **Seed button:** always visible, idempotent. Shows toast with count of inserted rows.
- **Delete:** trash icon button per row, immediate delete with confirmation via toast.
- **Styling:** matches employees page — `rounded-lg border` table, `text-destructive` on delete icon hover.
- **Empty state:** "No public holidays configured." row spanning all columns.

---

## Malta 2026 Holidays (hardcoded in seed route)

```
2026-01-01  New Year's Day
2026-02-10  Feast of St Paul's Shipwreck
2026-03-19  Feast of St Joseph
2026-03-31  Freedom Day
2026-04-03  Good Friday
2026-05-01  Worker's Day
2026-06-07  Sette Giugno
2026-06-29  Feast of St Peter and St Paul
2026-08-15  Feast of the Assumption
2026-09-08  Victory Day
2026-09-21  Independence Day
2026-12-08  Feast of the Immaculate Conception
2026-12-13  Republic Day
2026-12-25  Christmas Day
```

---

## Validation & Error Handling

- Zod validates all POST body inputs before touching the database.
- Duplicate date → 409 Conflict → toast error "A holiday on that date already exists."
- Empty name → client-side disabled submit button (name.trim() === '').
- Missing date → client-side disabled submit button.
- API errors surface via `toast.error(err.message)`.

---

## Auth

- Route protection: server client `getUser()` → employee record role check → `['hr_admin', 'super_admin']`.
- No new RLS policies needed: `public_holidays` has no employee-scoped data. The server client with service role access is NOT used — server client (RLS-respecting) is sufficient since HR admins have full access via their role check in the API route.

---

## Out of Scope

- Edit/rename existing holidays (delete + re-add covers this adequately).
- Schedule rules CRUD (separate future task — page is named "rules" but this PR is holidays only).
- Multi-year seed support.
