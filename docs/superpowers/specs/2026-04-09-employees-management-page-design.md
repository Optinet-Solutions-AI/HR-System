# Employees Management Page — Design Spec

## Overview

Admin page at `/employees` for managing employee configuration. Displays all employees in a searchable table with inline edit via dialog. Follows existing project conventions: server component page, `"use client"` interactive components, shadcn/ui + TanStack Table.

## Files

| File | Type | Purpose |
|---|---|---|
| `src/app/(admin)/employees/page.tsx` | Server component (replace existing stub) | Fetch all employees, render `<EmployeesTable>` |
| `src/components/employees/employees-table.tsx` | Client component | TanStack react-table with search, columns, edit trigger |
| `src/components/employees/edit-employee-dialog.tsx` | Client component | shadcn Dialog with update form, calls PATCH API |
| `src/app/api/employees/[id]/route.ts` | API route | PATCH handler with Zod validation + auth/role check |

## Page — `src/app/(admin)/employees/page.tsx`

- Server component (no `"use client"`)
- Uses `createServerSupabaseClient()` from `@/lib/supabase/server`
- Fetches all rows from `employees` table, ordered by `last_name asc`
- Checks for Supabase `error` — if error, displays error message
- Passes `employees` array as prop to `<EmployeesTable>`
- Page title: "Employee Configuration" with subtitle "Manage employee settings, roles, and WFH allocations"

## Table — `src/components/employees/employees-table.tsx`

### Setup
- `"use client"` component
- Uses `@tanstack/react-table` with `useReactTable`, `getCoreRowModel`, `getFilteredRowModel`, `getSortedRowModel`
- Renders using shadcn `<Table>` components from `@/components/ui/table`
- Accepts `employees: Employee[]` prop (type from `@/lib/types/app`)

### Search
- Single text input at the top for global filtering (filters across name and talexio_id)
- Uses TanStack's `globalFilterFn` with a custom fuzzy match on `first_name`, `last_name`, `talexio_id`

### Columns

| Column | Source | Render |
|---|---|---|
| Name | `${first_name} ${last_name}` | Plain text, sortable |
| Talexio ID | `talexio_id` | Monospace text |
| Office Days/Week | `office_days_per_week` | Number, centered |
| WFH Days/Week | `5 - office_days_per_week` | Number, centered |
| Role | `role` | Badge with role-specific color |
| Active | `is_active` | Badge (green/gray) |
| Notes | `notes` | Truncated to ~50 chars, full text in `title` attribute |
| Actions | — | Edit button (Pencil icon from lucide-react) |

### Badge Colors

**Role badges:**
- `employee` — `bg-blue-100 text-blue-800`
- `manager` — `bg-green-100 text-green-800`
- `hr_admin` — `bg-yellow-100 text-yellow-800`
- `super_admin` — `bg-red-100 text-red-800`

**Active badges:**
- `true` — `bg-green-100 text-green-800`, label "Active"
- `false` — `bg-gray-100 text-gray-500`, label "Inactive"

### State
- Manages `editingEmployee: Employee | null` — when set, opens the edit dialog
- On dialog close or successful save, sets back to `null`

## Edit Dialog — `src/components/employees/edit-employee-dialog.tsx`

### Props
- `employee: Employee | null` — the employee being edited (null = closed)
- `open: boolean` — dialog open state
- `onOpenChange: (open: boolean) => void` — close handler

### Dialog Content
- Title: "Edit {first_name} {last_name}"
- Description: "Update employee configuration"

### Form Fields

| Field | Input | Validation |
|---|---|---|
| `office_days_per_week` | `<Input type="number" min={0} max={5} step={1}>` | Required, integer 0-5 |
| `role` | `<Select>` with options: employee, manager, hr_admin, super_admin | Required |
| `notes` | `<textarea>` with Tailwind styling | Optional, string or empty |
| `is_active` | `<input type="checkbox">` styled consistently | Required, boolean |

The form initializes from the `employee` prop values when the dialog opens.

### Submit Behavior
1. Disable submit button, show loading state
2. `fetch('/api/employees/${employee.id}', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })`
3. On success: close dialog, show success toast via `sonner`, call `router.refresh()` to re-fetch server data
4. On error: show error toast, keep dialog open, re-enable button

## API Route — `src/app/api/employees/[id]/route.ts`

### PATCH Handler

1. **Auth check:** Get user via `supabase.auth.getUser()`. Return 401 if not authenticated.
2. **Role check:** Query `employees` table for the authenticated user's role. Return 403 if not `hr_admin` or `super_admin`.
3. **Validate params:** Ensure `id` from route params is a valid UUID.
4. **Validate body:** Zod schema:
   ```typescript
   z.object({
     office_days_per_week: z.number().int().min(0).max(5),
     role: z.enum(['employee', 'manager', 'hr_admin', 'super_admin']),
     notes: z.string().nullable(),
     is_active: z.boolean(),
   })
   ```
5. **Update:** Use server Supabase client to update `employees` table where `id` matches.
6. **Return:** `{ data: updatedEmployee }` on success, `{ error, message }` on failure with appropriate status code.

## Data Flow

```
page.tsx (server) — fetch employees via Supabase server client
  └─> <EmployeesTable employees={data}>  (client)
        ├─> renders TanStack table with all columns
        ├─> search input filters rows client-side
        └─> Edit button sets editingEmployee state
              └─> <EditEmployeeDialog employee={editingEmployee}>
                    ├─> form pre-filled with current values
                    └─> submit → PATCH /api/employees/[id]
                          ├─> success → toast + router.refresh() → page re-fetches
                          └─> error → toast, dialog stays open
```

## Dependencies (all already installed)

- `@tanstack/react-table` — table logic
- `@supabase/ssr` — server/client Supabase
- `zod` — API validation
- `lucide-react` — icons (Pencil, Search)
- `sonner` — toast notifications
- shadcn/ui: `table`, `badge`, `dialog`, `button`, `input`, `select`, `label`
