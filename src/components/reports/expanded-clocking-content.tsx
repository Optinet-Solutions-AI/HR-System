'use client'

import { useMemo } from 'react'
import { parseISO, format, eachDayOfInterval, isWeekend } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CLOCKING_STATUS_LABELS, LOCATION_DISPLAY } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Clocking } from '@/lib/types/app'

interface ExpandedClockingContentProps {
  employeeName: string
  businessUnit: string | null
  clockings: Clocking[]
  from: string
  to: string
  isLoading: boolean
}

// ─── Calendar Day Bar ────────────────────────────────────────────────────────

function CalendarBar({ clockings, from, to }: { clockings: Clocking[]; from: string; to: string }) {
  const clockingByDate = useMemo(() => {
    const map = new Map<string, Clocking>()
    for (const c of clockings) {
      map.set(c.date, c)
    }
    return map
  }, [clockings])

  const days = useMemo(() => {
    return eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
  }, [from, to])

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayNum = day.getDate()
        const weekend = isWeekend(day)
        const clocking = clockingByDate.get(dateStr)

        let dotColor = ''
        if (clocking) {
          const isBroken = clocking.clocking_status === 'Broken clocking'
          const isRemote = clocking.location_in_name === 'Home'
          if (isBroken) {
            dotColor = 'bg-red-500'
          } else if (isRemote) {
            dotColor = 'bg-blue-500'
          } else {
            dotColor = 'bg-green-500'
          }
        }

        return (
          <div
            key={dateStr}
            className={cn(
              'flex flex-col items-center justify-center w-7 h-9 rounded text-[10px] font-medium shrink-0',
              weekend && 'opacity-40',
              clocking && !weekend && 'bg-muted/80',
            )}
          >
            <span className={cn('leading-none', weekend ? 'text-muted-foreground' : 'text-foreground')}>
              {dayNum}
            </span>
            {dotColor ? (
              <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', dotColor)} />
            ) : (
              <span className="mt-0.5 h-1.5 w-1.5" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
        <div className="h-8 w-20 bg-muted rounded" />
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-9 w-7 bg-muted rounded" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ExpandedClockingContent({
  employeeName,
  businessUnit,
  clockings,
  from,
  to,
  isLoading,
}: ExpandedClockingContentProps) {
  const totalHours = useMemo(() => {
    return clockings.reduce((sum, c) => sum + (c.hours_worked ?? 0), 0)
  }, [clockings])

  if (isLoading) {
    return (
      <div className="bg-muted/30 px-6 py-4">
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="bg-muted/30 px-6 py-4 space-y-4">
      {/* Employee Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{employeeName}</p>
          {businessUnit && (
            <p className="text-xs text-muted-foreground">{businessUnit}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            {totalHours > 0 ? `${totalHours.toFixed(2)}h` : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Calendar Day Bar */}
      <CalendarBar clockings={clockings} from={from} to={to} />

      {/* Clocking Detail Table */}
      {clockings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No clocking records for the selected period.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Day</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Time In</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Time Out</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Hours</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Location</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clockings.map((clocking) => {
                const isBroken = clocking.clocking_status === 'Broken clocking'
                const locationLabel = clocking.location_in_name
                  ? (LOCATION_DISPLAY[clocking.location_in_name] ?? clocking.location_in_name.toUpperCase())
                  : '—'
                const statusLabel = clocking.clocking_status
                  ? (CLOCKING_STATUS_LABELS[clocking.clocking_status] ?? clocking.clocking_status)
                  : '—'

                return (
                  <TableRow key={clocking.id}>
                    <TableCell className="font-mono text-sm">
                      {format(parseISO(clocking.date), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {clocking.day_of_week}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {clocking.time_in ?? '—'}
                    </TableCell>
                    <TableCell className={cn('font-mono text-sm', isBroken && 'text-red-600 font-medium')}>
                      {isBroken ? 'Broken Clocking' : (clocking.time_out ?? '—')}
                    </TableCell>
                    <TableCell className={cn('font-mono text-sm', isBroken && 'text-muted-foreground')}>
                      {clocking.hours_worked != null ? `${clocking.hours_worked}h` : '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-xs font-semibold uppercase tracking-wide',
                          locationLabel === 'REMOTE' && 'text-blue-600',
                          locationLabel === 'HEAD OFFICE' && 'text-green-700',
                        )}
                      >
                        {locationLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isBroken ? (
                        <Badge className="bg-red-100 text-red-800 border-0 text-xs">
                          BROKEN
                        </Badge>
                      ) : statusLabel === 'OK' ? (
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs">
                          OK
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{statusLabel}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
