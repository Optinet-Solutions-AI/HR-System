# Employees Management Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin employees management page with a searchable data table and inline edit dialog that calls a PATCH API route.

**Architecture:** Server component page fetches all employees via Supabase server client, passes data to a client-side TanStack react-table component. Edit button per row opens a shadcn Dialog with a form that PATCHes `/api/employees/[id]`. After save, `router.refresh()` re-fetches server data.

**Tech Stack:** Next.js 14 App Router, Supabase SSR, @tanstack/react-table, shadcn/ui (dialog, table, badge, select, input, button, label), Zod, sonner, lucide-react

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/employees/[id]/route.ts` | Create | PATCH handler: auth, role check, Zod validation, DB update |
| `src/components/employees/employees-table.tsx` | Create | Client component: TanStack table, columns, search, edit state |
| `src/components/employees/edit-employee-dialog.tsx` | Create | Client component: shadcn Dialog with form, PATCH call, toast |
| `src/app/(admin)/employees/page.tsx` | Replace | Server component: fetch employees, render page header + table |

---

### Task 1: PATCH API Route

**Files:**
- Create: `src/app/api/employees/[id]/route.ts`

- [ ] **Step 1: Create the API route file**

Create `src/app/api/employees/[id]/route.ts`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateEmployeeSchema = z.object({
  office_days_per_week: z.number().int().min(0).max(5),
  role: z.enum(['employee', 'manager', 'hr_admin', 'super_admin']),
  notes: z.string().nullable(),
  is_active: z.boolean(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check — only hr_admin and super_admin can edit employees
  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentEmployee || !['hr_admin', 'super_admin'].includes(currentEmployee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate route param
  const { id } = await params
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return Response.json({ error: 'Invalid employee ID' }, { status: 400 })
  }

  // Validate body
  const body = await request.json()
  const parsed = updateEmployeeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  // Update employee
  const { data, error } = await supabase
    .from('employees')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data })
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors related to `src/app/api/employees/[id]/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/employees/\[id\]/route.ts
git commit -m "feat: add PATCH /api/employees/[id] route with auth and validation"
```

---

### Task 2: Edit Employee Dialog

**Files:**
- Create: `src/components/employees/edit-employee-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/components/employees/edit-employee-dialog.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Employee, UserRole } from '@/lib/types/app'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'hr_admin', label: 'HR Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

interface EditEmployeeDialogProps {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: EditEmployeeDialogProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [officeDays, setOfficeDays] = useState(4)
  const [role, setRole] = useState<UserRole>('employee')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Reset form when employee changes
  useEffect(() => {
    if (employee) {
      setOfficeDays(employee.office_days_per_week)
      setRole(employee.role)
      setNotes(employee.notes ?? '')
      setIsActive(employee.is_active)
    }
  }, [employee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return

    setSaving(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          office_days_per_week: officeDays,
          role,
          notes: notes.trim() || null,
          is_active: isActive,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to update employee')
      }

      toast.success(`Updated ${employee.first_name} ${employee.last_name}`)
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {employee?.first_name} {employee?.last_name}
          </DialogTitle>
          <DialogDescription>
            Update employee configuration
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Office Days per Week */}
            <div className="grid gap-2">
              <Label htmlFor="officeDays">Office Days per Week</Label>
              <Input
                id="officeDays"
                type="number"
                min={0}
                max={5}
                step={1}
                value={officeDays}
                onChange={(e) => setOfficeDays(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                WFH days: {5 - officeDays} per week
              </p>
            </div>

            {/* Role */}
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <Label htmlFor="isActive">Active Employee</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors related to `edit-employee-dialog.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/employees/edit-employee-dialog.tsx
git commit -m "feat: add EditEmployeeDialog component with form and PATCH call"
```

---

### Task 3: Employees Table

**Files:**
- Create: `src/components/employees/employees-table.tsx`

- [ ] **Step 1: Create the table component**

Create `src/components/employees/employees-table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Pencil, Search, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog'
import type { Employee } from '@/lib/types/app'

const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  hr_admin: 'bg-yellow-100 text-yellow-800',
  super_admin: 'bg-red-100 text-red-800',
}

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
}

const columns: ColumnDef<Employee>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name
        <ArrowUpDown className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'talexio_id',
    header: 'Talexio ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string | null>() ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'office_days_per_week',
    header: 'Office Days/Week',
    cell: ({ getValue }) => (
      <span className="text-center block">{getValue<number>()}</span>
    ),
  },
  {
    id: 'wfh_days',
    accessorFn: (row) => 5 - row.office_days_per_week,
    header: 'WFH Days/Week',
    cell: ({ getValue }) => (
      <span className="text-center block">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ getValue }) => {
      const role = getValue<string>()
      return (
        <Badge className={ROLE_COLORS[role]}>
          {ROLE_LABELS[role] ?? role}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'is_active',
    header: 'Active',
    cell: ({ getValue }) => {
      const active = getValue<boolean>()
      return (
        <Badge className={active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ getValue }) => {
      const notes = getValue<string | null>()
      if (!notes) return <span className="text-muted-foreground">—</span>
      const truncated = notes.length > 50 ? `${notes.slice(0, 50)}...` : notes
      return <span title={notes}>{truncated}</span>
    },
  },
]

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  const table = useReactTable({
    data: employees,
    columns: [
      ...columns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditingEmployee(row.original)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ),
      },
    ],
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase()
      const name = `${row.original.first_name} ${row.original.last_name}`.toLowerCase()
      const talexioId = (row.original.talexio_id ?? '').toLowerCase()
      return name.includes(search) || talexioId.includes(search)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or Talexio ID..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} employee{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditEmployeeDialog
        employee={editingEmployee}
        open={editingEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEmployee(null)
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors related to `employees-table.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/employees/employees-table.tsx
git commit -m "feat: add EmployeesTable component with TanStack table and search"
```

---

### Task 4: Server Page

**Files:**
- Modify: `src/app/(admin)/employees/page.tsx`

- [ ] **Step 1: Replace the stub page**

Replace `src/app/(admin)/employees/page.tsx` with:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EmployeesTable } from '@/components/employees/employees-table'

export default async function EmployeesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('last_name', { ascending: true })

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Employee Configuration</h1>
        <p className="text-destructive">Failed to load employees: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Employee Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage employee settings, roles, and WFH allocations
        </p>
      </div>
      <EmployeesTable employees={employees ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Verify the page compiles**

Run: `cd "c:/Users/windows 11/Desktop/HR/wfh-sentinel" && npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: no errors

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`

Navigate to `http://localhost:3000/employees`. Verify:
- Page renders with title and subtitle
- Table shows all employees with correct columns
- Search filters by name and Talexio ID
- Name column is sortable
- Role badges use correct colors (blue/green/yellow/red)
- Active badges show green "Active" or gray "Inactive"
- Notes are truncated with tooltip on hover
- Edit button opens dialog with pre-filled values
- Submitting the dialog updates the employee and shows a toast

- [ ] **Step 4: Commit**

```bash
git add src/app/\(admin\)/employees/page.tsx
git commit -m "feat: build employees management page with server-side data fetching"
```
