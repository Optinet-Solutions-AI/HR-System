'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, CalendarOff, Plus, Sparkles } from 'lucide-react'
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
      const json = await res.json()
      const inserted = typeof json?.data?.inserted === 'number' ? json.data.inserted : 0
      toast.success(
        inserted === 0
          ? 'Malta 2026 holidays already present — nothing added.'
          : `Seeded ${inserted} Malta 2026 holiday${inserted !== 1 ? 's' : ''}.`
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">Holidays Calendar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeed}
          disabled={seeding}
          className="h-8 rounded-lg px-4 text-xs font-medium w-full sm:w-auto"
        >
          <Sparkles className="size-3.5 mr-1.5" />
          {seeding ? 'Seeding...' : 'Seed Malta 2026 defaults'}
        </Button>
      </div>

      {/* Add form */}
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 sm:p-4">
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="grid gap-1 sm:w-44">
            <Label htmlFor="holiday-date" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Date
            </Label>
            <Input
              id="holiday-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 rounded-lg text-sm"
            />
          </div>
          <div className="grid gap-1 flex-1">
            <Label htmlFor="holiday-name" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Holiday Name
            </Label>
            <Input
              id="holiday-name"
              type="text"
              placeholder="e.g. Good Friday"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 rounded-lg text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={!canAdd || adding}
            className="h-8 rounded-lg px-4 text-xs font-semibold w-full sm:w-auto"
          >
            <Plus className="size-3.5 mr-1.5" />
            {adding ? 'Adding...' : 'Add Holiday'}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date</TableHead>
              <TableHead className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Name</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CalendarOff className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm">No public holidays configured</p>
                    <p className="text-xs">Add holidays manually or seed the Malta 2026 defaults</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[12px] text-muted-foreground">
                      {holiday.date}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{holiday.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={deletingId === holiday.id}
                      onClick={() => handleDelete(holiday)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      aria-label={`Remove ${holiday.name}`}
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
