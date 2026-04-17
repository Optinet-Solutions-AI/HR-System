'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  parseISO,
  format,
  addDays,
  addWeeks,
  subWeeks,
  getDay,
  getISOWeek,
  eachDayOfInterval,
} from 'date-fns'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  STATUS_COLORS,
  ACTUAL_STATUS_COLOR_MAP,
  ACTUAL_STATUS_LABELS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ComplianceStatusCell } from './compliance-status-cell'
import { ComplianceDetailSheet } from './compliance-detail-sheet'
import type { Employee, ComplianceRecord, ComplianceWeekRow } from '@/lib/types/app'

interface ComplianceWeeklyGridProps {
  employees: Pick<Employee, 'id' | 'first_name' | 'last_name'>[]
  complianceRecords: ComplianceRecord[]
  week: string // Monday date, e.g. "2026-04-07"
}

interface WeekDay {
  date: string
  dayOfWeek: number
  dayOfMonth: number
}

const DAY_ABBREV = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function ComplianceWeeklyGrid({
  employees,
  complianceRecords,
  week,
}: ComplianceWeeklyGridProps) {
  const router = useRouter()

  const [selected, setSelected] = useState<{
    record: ComplianceRecord
    employeeName: string
  } | null>(null)

  // Build Mon-Fri days (use stable `week` string as dependency)
  const weekDays = useMemo<WeekDay[]>(() => {
    const start = parseISO(week)
    const end = addDays(start, 4)
    return eachDayOfInterval({ start, end }).map((d) => ({
      date: format(d, 'yyyy-MM-dd'),
      dayOfWeek: getDay(d),
      dayOfMonth: d.getDate(),
    }))
  }, [week])

  // Derived dates for display
  const weekDate = parseISO(week)
  const fridayDate = addDays(weekDate, 4)

  // Build lookup and pivot rows
  const rows = useMemo<ComplianceWeekRow[]>(() => {
    const lookup = new Map<string, ComplianceRecord>()
    for (const r of complianceRecords) {
      lookup.set(`${r.employee_id}:${r.date}`, r)
    }

    return employees.map((emp) => ({
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      dates: Object.fromEntries(
        weekDays.map((d) => [d.date, lookup.get(`${emp.id}:${d.date}`) ?? null])
      ),
    }))
  }, [employees, complianceRecords, weekDays])

  // Summary per day
  const daySummaries = useMemo(() => {
    const summaries: Record<string, { compliant: number; flagged: number }> = {}
    for (const day of weekDays) {
      let compliant = 0
      let flagged = 0
      for (const row of rows) {
        const record = row.dates[day.date]
        if (!record) continue
        if (record.is_compliant) compliant++
        if ((record.flags ?? []).length > 0) flagged++
      }
      summaries[day.date] = { compliant, flagged }
    }
    return summaries
  }, [weekDays, rows])

  // Dynamic columns
  const columns = useMemo<ColumnDef<ComplianceWeekRow>[]>(() => {
    const fixed: ColumnDef<ComplianceWeekRow>[] = [
      {
        id: 'employeeName',
        accessorKey: 'employeeName',
        header: 'Employee',
        cell: ({ getValue }) => (
          <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>
        ),
        size: 160,
      },
    ]

    const dateCols: ColumnDef<ComplianceWeekRow>[] = weekDays.map((day) => ({
      id: `date_${day.date}`,
      header: () => (
        <div className="text-center text-[10px] leading-tight">
          <div>{DAY_ABBREV[day.dayOfWeek]}</div>
          <div className="font-bold">{day.dayOfMonth}</div>
        </div>
      ),
      accessorFn: (row: ComplianceWeekRow) => row.dates[day.date],
      cell: ({ getValue, row }) => {
        const record = getValue<ComplianceRecord | null>()
        return (
          <ComplianceStatusCell
            record={record}
            onClick={
              record
                ? () =>
                    setSelected({
                      record,
                      employeeName: row.original.employeeName,
                    })
                : undefined
            }
          />
        )
      },
      size: 80,
    }))

    return [...fixed, ...dateCols]
  }, [weekDays])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Week navigation
  const goToWeek = (offset: number) => {
    const target = offset > 0 ? addWeeks(weekDate, offset) : subWeeks(weekDate, -offset)
    router.push(`/admin/compliance?week=${format(target, 'yyyy-MM-dd')}`)
  }

  // Legend entries: deduplicate actual statuses present in the data
  const legendStatuses = useMemo(() => {
    const seen = new Set<string>()
    for (const r of complianceRecords) {
      seen.add(r.actual_status)
    }
    return Array.from(seen).sort()
  }, [complianceRecords])

  return (
    <div className="space-y-4 px-4 py-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Weekly Compliance</h1>
          <p className="text-sm text-muted-foreground">
            Compliance status for all employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => goToWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-0 flex-1 text-center text-sm font-semibold sm:min-w-[200px] sm:text-base">
            Week {getISOWeek(weekDate)}: {format(weekDate, 'd MMM')} &ndash;{' '}
            {format(fridayDate, 'd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => goToWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="rounded-lg border min-w-[500px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'px-1',
                      header.column.id === 'employeeName' &&
                        'sticky left-0 z-10 bg-background'
                    )}
                    style={
                      header.column.id === 'employeeName'
                        ? { width: 160, minWidth: 160 }
                        : { width: 80, minWidth: 80 }
                    }
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No employees found.
                </TableCell>
              </TableRow>
            ) : complianceRecords.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No compliance records for this week yet. Records are generated by the daily compliance job.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-1 py-1',
                        cell.column.id === 'employeeName' &&
                          'sticky left-0 z-10 bg-background'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>

          {/* Summary footer */}
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-muted/50 px-1 font-semibold">
                  Totals
                </TableCell>
                {weekDays.map((day) => {
                  const summary = daySummaries[day.date]
                  const hasFlagged = summary.flagged > 0
                  return (
                    <TableCell
                      key={day.date}
                      className={cn(
                        'px-1 py-1 text-center',
                        hasFlagged &&
                          cn(
                            STATUS_COLORS.violation.bg,
                            STATUS_COLORS.violation.text,
                            'ring-2 ring-red-300 rounded'
                          )
                      )}
                    >
                      <div className="text-[9px] leading-tight">
                        <div className="text-green-700">{summary.compliant}C</div>
                        <div className="text-red-700">{summary.flagged}F</div>
                      </div>
                    </TableCell>
                  )
                })}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {legendStatuses.map((status) => {
          const colorKey = ACTUAL_STATUS_COLOR_MAP[status] ?? 'unknown'
          const colors = STATUS_COLORS[colorKey]
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn('inline-block h-3 w-3 rounded-full', colors.dot)} />
              <span>{ACTUAL_STATUS_LABELS[status] ?? status}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          <span>Has flags</span>
        </div>
      </div>

      {/* Detail Sheet */}
      <ComplianceDetailSheet
        record={selected?.record ?? null}
        employeeName={selected?.employeeName ?? ''}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        onOverrideSuccess={() => {
          setSelected(null)
          router.refresh()
        }}
      />
    </div>
  )
}
