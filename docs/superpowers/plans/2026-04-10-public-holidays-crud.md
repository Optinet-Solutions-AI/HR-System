# Public Holidays CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public holidays management panel to the admin rules page with add/delete and a one-click Malta 2026 seed button.

**Architecture:** Server component page fetches holidays and passes them to a `"use client"` `HolidaysPanel` component. Mutations go through three new API routes (`/api/holidays`, `/api/holidays/[id]`, `/api/holidays/seed`) mirroring the employees API pattern: auth + role check via server client, writes via admin client.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase JS SDK, Zod v4, shadcn/ui (Button, Input, Label, Table), Tailwind CSS, Sonner (toast), Lucide React icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/holidays/route.ts` | Create | GET list + POST add single |
| `src/app/api/holidays/[id]/route.ts` | Create | DELETE by id |
| `src/app/api/holidays/seed/route.ts` | Create | POST seed Malta 2026 (idempotent) |
| `src/components/holidays/holidays-panel.tsx` | Create | Client component — table + add form + seed button |
| `src/app/(admin)/rules/page.tsx` | Modify | Server component — fetch + render HolidaysPanel |

---

### Task 1: GET + POST /api/holidays

**Files:**
- Create: `src/app/api/holidays/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/holidays/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const addHolidaySchema = z.object({
  date: z.string().date(),
  name: z.string().min(1, 'Name is required'),
})

async function requireHrAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 } as const

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return { error: 'Forbidden', status: 403 } as const
  }

  return { error: null, status: 200 } as const
}

export async function GET() {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ data })
}

export async function POST(request: Request) {
  const auth = await requireHrAdmin()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const parsed = addHolidaySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .insert({ date: parsed.data.date, name: parsed.data.name })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A holiday on that date already exists.' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data }, { status: 201 })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors in `src/app/api/holidays/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/holidays/route.ts
git commit -m "feat: add GET + POST /api/holidays route"
```

---

### Task 2: DELETE /api/holidays/[id]

**Files:**
- Create: `src/app/api/holidays/[id]/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/holidays/[id]/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!UUID_REGEX.test(id)) {
    return Response.json({ error: 'Invalid holiday ID' }, { status: 400 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .delete()
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // PGRST116 = no rows returned (not found)
    if (error.code === 'PGRST116') {
      return Response.json({ error: 'Holiday not found' }, { status: 404 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ data })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/holidays/[id]/route.ts"
git commit -m "feat: add DELETE /api/holidays/[id] route"
```

---

### Task 3: POST /api/holidays/seed

**Files:**
- Create: `src/app/api/holidays/seed/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/holidays/seed/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

const MALTA_2026_HOLIDAYS = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-10', name: "Feast of St Paul's Shipwreck" },
  { date: '2026-03-19', name: 'Feast of St Joseph' },
  { date: '2026-03-31', name: 'Freedom Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: "Worker's Day" },
  { date: '2026-06-07', name: 'Sette Giugno' },
  { date: '2026-06-29', name: 'Feast of St Peter and St Paul' },
  { date: '2026-08-15', name: 'Feast of the Assumption' },
  { date: '2026-09-08', name: 'Victory Day' },
  { date: '2026-09-21', name: 'Independence Day' },
  { date: '2026-12-08', name: 'Feast of the Immaculate Conception' },
  { date: '2026-12-13', name: 'Republic Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
]

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('public_holidays')
    .upsert(MALTA_2026_HOLIDAYS, { onConflict: 'date', ignoreDuplicates: true })
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ data: { inserted: data?.length ?? 0 } })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add src/app/api/holidays/seed/route.ts
git commit -m "feat: add POST /api/holidays/seed (Malta 2026, idempotent upsert)"
```

---

### Task 4: HolidaysPanel client component

**Files:**
- Create: `src/components/holidays/holidays-panel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/components/holidays/holidays-panel.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PublicHoliday } from '@/lib/types/app'

export function HolidaysPanel({ holidays }: { holidays: PublicHoliday[] }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name: name.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to add holiday')
      }
      toast.success(`Added ${name.trim()}`)
      setDate('')
      setName('')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add holiday')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(holiday: PublicHoliday) {
    setDeletingId(holiday.id)
    try {
      const res = await fetch(`/api/holidays/${holiday.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to delete holiday')
      }
      toast.success(`Removed ${holiday.name}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete holiday')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await fetch('/api/holidays/seed', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(typeof err.error === 'string' ? err.error : 'Failed to seed holidays')
      }
      const { data } = await res.json()
      toast.success(
        data.inserted === 0
          ? 'Malta 2026 holidays already present — nothing added.'
          : `Seeded ${data.inserted} Malta 2026 holiday${data.inserted !== 1 ? 's' : ''}.`
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed holidays')
    } finally {
      setSeeding(false)
    }
  }

  const canAdd = date !== '' && name.trim() !== ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Public Holidays</h2>
        <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
          {seeding ? 'Seeding...' : 'Seed Malta 2026 defaults'}
        </Button>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="holiday-date">Date</Label>
          <Input
            id="holiday-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="grid gap-1 flex-1">
          <Label htmlFor="holiday-name">Name</Label>
          <Input
            id="holiday-name"
            type="text"
            placeholder="e.g. Good Friday"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!canAdd || adding}>
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No public holidays configured.
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell className="font-mono text-sm">{holiday.date}</TableCell>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={deletingId === holiday.id}
                      onClick={() => handleDelete(holiday)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
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

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 3: Commit**

```bash
git add src/components/holidays/holidays-panel.tsx
git commit -m "feat: add HolidaysPanel client component"
```

---

### Task 5: Update rules page

**Files:**
- Modify: `src/app/(admin)/rules/page.tsx`

- [ ] **Step 1: Replace the stub**

Full file content (replace entirely):

```typescript
// src/app/(admin)/rules/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { HolidaysPanel } from '@/components/holidays/holidays-panel'

export default async function RulesPage() {
  const supabase = await createServerSupabaseClient()

  const { data: holidays, error } = await supabase
    .from('public_holidays')
    .select('*')
    .order('date', { ascending: true })

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Schedule Rules</h1>
        <p className="text-destructive">Failed to load holidays: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule Rules</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage public holidays and scheduling constraints
        </p>
      </div>
      <HolidaysPanel holidays={holidays ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0

- [ ] **Step 3: Start dev server and verify in browser**

Run: `npm run dev`

Navigate to the admin rules page (`/rules`). Check each of these manually:

1. Page loads with table (empty if database has no holidays)
2. Click "Seed Malta 2026 defaults" → toast "Seeded 14 Malta 2026 holidays." → 14 rows appear
3. Click "Seed Malta 2026 defaults" again → toast "Malta 2026 holidays already present — nothing added."
4. Fill in Date + Name, click Add → new row appears at correct sorted position, toast confirms
5. Add the same date again → toast error "A holiday on that date already exists."
6. Click trash icon on any row → row disappears, toast "Removed [name]"
7. Add button is disabled when date or name is empty

- [ ] **Step 4: Commit**

```bash
git add src/app/(admin)/rules/page.tsx
git commit -m "feat: wire public holidays CRUD into admin rules page"
```
