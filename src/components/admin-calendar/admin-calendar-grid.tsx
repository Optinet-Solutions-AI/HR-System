'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import {
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
import { STATUS_COLORS, SCHEDULE_STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { StatusCell } from './status-cell'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Employee, Schedule, PublicHoliday, ScheduleStatus, CalendarRow } from '@/lib/types/app'

type EmployeeData = Pick<Employee, 'id' | 'first_name' | 'last_name' | 'office_days_per_week'>
type ScheduleData = Pick<Schedule, 'employee_id' | 'date' | 'status'>
type HolidayData = Pick<PublicHoliday, 'date' | 'name'>

interface AdminCalendarGridProps {
  employees: EmployeeData[]
  schedules: ScheduleData[]
  publicHolidays: HolidayData[]
  month: string
  maxWfhPerDay: number | null
}

interface WorkingDay {
  date: string
  dayOfWeek: number
  dayOfMonth: number
  isHoliday: boolean
  holidayName?: string
}

const DAY_ABBREV = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] // index 1-5

export function AdminCalendarGrid({
  employees: initialEmployees,
  schedules: initialSchedules,
  publicHolidays: initialHolidays,
  month: initialMonth,
  maxWfhPerDay: initialMaxWfhPerDay,
}: AdminCalendarGridProps) {
  const [month, setMonth] = useState(initialMonth)
  const [employees, setEmployees] = useState<EmployeeData[]>(initialEmployees)
  const [schedules, setSchedules] = useState<ScheduleData[]>(initialSchedules)
  const [publicHolidays, setPublicHolidays] = useState<HolidayData[]>(initialHolidays)
  const [maxWfhPerDay, setMaxWfhPerDay] = useState(initialMaxWfhPerDay)
  const [isLoading, setIsLoading] = useState(false)

  // Stable Supabase client — created once, reused across navigations
  const supabaseRef = useRef(createBrowserSupabaseClient())

  // Use `month` string as dependency key (stable), not a Date object
  const workingDays = useMemo<WorkingDay[]>(() => {
    const monthDate = parseISO(`${month}-01`)
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const holidayDates = new Map(publicHolidays.map((h) => [h.date, h.name]))

    return allDays
      .filter((d) => {
        const dow = getDay(d)
        return dow >= 1 && dow <= 5 // Mon-Fri
      })
      .map((d) => {
        const dateStr = format(d, 'yyyy-MM-dd')
        return {
          date: dateStr,
          dayOfWeek: getDay(d),
          dayOfMonth: d.getDate(),
          isHoliday: holidayDates.has(dateStr),
          holidayName: holidayDates.get(dateStr),
        }
      })
  }, [month, publicHolidays])

  // Build schedule lookup and pivot into rows
  const rows = useMemo<CalendarRow[]>(() => {
    const lookup = new Map<string, ScheduleStatus>()
    for (const s of schedules) {
      lookup.set(`${s.employee_id}:${s.date}`, s.status)
    }

    return employees.map((emp) => ({
      employeeId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      officeDaysPerWeek: emp.office_days_per_week,
      dates: Object.fromEntries(
        workingDays.map((d) => [
          d.date,
          d.isHoliday
            ? ('public_holiday' as ScheduleStatus)
            : (lookup.get(`${emp.id}:${d.date}`) ?? ('not_scheduled' as ScheduleStatus)),
        ])
      ),
    }))
  }, [employees, schedules, workingDays])

  // Summary totals per day
  const daySummaries = useMemo(() => {
    const summaries: Record<string, { office: number; wfh: number }> = {}
    for (const day of workingDays) {
      let office = 0
      let wfh = 0
      for (const row of rows) {
        const s = row.dates[day.date]
        if (s === 'office') office++
        if (s === 'wfh') wfh++
      }
      summaries[day.date] = { office, wfh }
    }
    return summaries
  }, [workingDays, rows])

  // WFH threshold for highlighting
  const wfhThreshold = maxWfhPerDay ?? Math.ceil(employees.length * 0.3)

  // Dynamic column definitions
  const columns = useMemo<ColumnDef<CalendarRow>[]>(() => {
    const fixed: ColumnDef<CalendarRow>[] = [
      {
        id: 'employeeName',
        accessorKey: 'employeeName',
        header: 'Employee',
        cell: ({ getValue }) => (
          <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>
        ),
        size: 160,
      },
      {
        id: 'officeDays',
        accessorKey: 'officeDaysPerWeek',
        header: () => <span className="text-xs">Office</span>,
        cell: ({ getValue }) => (
          <span className="block text-center text-xs text-muted-foreground">
            {getValue<number>()}/5
          </span>
        ),
        size: 50,
      },
    ]

    const dateCols: ColumnDef<CalendarRow>[] = workingDays.map((day) => ({
      id: `date_${day.date}`,
      header: () => (
        <div
          className={cn(
            'text-center text-[10px] leading-tight',
            day.isHoliday && 'text-muted-foreground'
          )}
          title={day.isHoliday ? day.holidayName : undefined}
        >
          <div>{DAY_ABBREV[day.dayOfWeek]}</div>
          <div className="font-bold">{day.dayOfMonth}</div>
        </div>
      ),
      accessorFn: (row: CalendarRow) => row.dates[day.date],
      cell: ({ getValue }) => <StatusCell status={getValue<ScheduleStatus>()} />,
      size: 36,
    }))

    return [...fixed, ...dateCols]
  }, [workingDays])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Month navigation — client-side fetch, no full page reload
  const goToMonth = useCallback(async (offset: number) => {
    const currentMonthDate = parseISO(`${month}-01`)
    const target = offset > 0 ? addMonths(currentMonthDate, offset) : subMonths(currentMonthDate, -offset)
    const targetMonth = format(target, 'yyyy-MM')
    const dateFrom = `${targetMonth}-01`
    const dateTo = format(endOfMonth(target), 'yyyy-MM-dd')

    setIsLoading(true)
    try {
      const supabase = supabaseRef.current
      const [employeesResult, schedulesResult, holidaysResult, rulesResult] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name, office_days_per_week')
          .eq('is_active', true)
          .order('last_name'),
        supabase
          .from('schedules')
          .select('employee_id, date, status')
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('public_holidays')
          .select('date, name')
          .gte('date', dateFrom)
          .lte('date', dateTo),
        supabase
          .from('schedule_rules')
          .select('*')
          .eq('is_active', true)
          .eq('rule_type', 'MAX_WFH_PER_DAY'),
      ])

      const error =
        employeesResult.error ?? schedulesResult.error ?? holidaysResult.error ?? rulesResult.error
      if (error) {
        console.error('Failed to fetch calendar data:', error.message)
        return
      }

      // Batch all state updates together so React renders once
      setEmployees(employeesResult.data!)
      setSchedules(schedulesResult.data!)
      setPublicHolidays(holidaysResult.data!)
      const maxWfhRule = rulesResult.data![0]
      setMaxWfhPerDay(
        maxWfhRule ? (maxWfhRule.value as { maxCount?: number }).maxCount ?? null : null
      )
      setMonth(targetMonth)

      // Update URL for bookmarkability without triggering navigation
      window.history.replaceState(null, '', `/admin/calendar?month=${targetMonth}`)
    } catch (err) {
      console.error('Failed to navigate month:', err)
    } finally {
      setIsLoading(false)
    }
  }, [month])

  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy')

  return (
    <div className="space-y-4 px-4 py-4 sm:p-6">
      {/* Header: title + month nav */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Calendar Overview</h1>
          <p className="text-sm text-muted-foreground">
            Schedule overview for all employees
          </p>
        </div>
        <div className="flex items-center gap-2 select-none">
          <Button variant="outline" size="icon" onClick={() => goToMonth(-1)} disabled={isLoading}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-0 flex-1 text-center text-sm font-semibold flex items-center justify-center gap-2 cursor-default sm:min-w-[140px] sm:text-base">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {monthLabel}
          </span>
          <Button variant="outline" size="icon" onClick={() => goToMonth(1)} disabled={isLoading}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className={cn('rounded-lg border transition-opacity duration-150 min-w-[700px]', isLoading && 'opacity-50')}>
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
                        'sticky left-0 z-10 bg-background',
                      header.column.id !== 'employeeName' &&
                        header.column.id !== 'officeDays' &&
                        'w-9 min-w-9'
                    )}
                    style={
                      header.column.id === 'employeeName'
                        ? { width: 160, minWidth: 160 }
                        : header.column.id === 'officeDays'
                          ? { width: 50, minWidth: 50 }
                          : { width: 36, minWidth: 36 }
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
                {/* Fixed columns: label + empty */}
                <TableCell className="sticky left-0 z-10 bg-muted/50 px-1 font-semibold">
                  Totals
                </TableCell>
                <TableCell className="px-1" />
                {/* Date columns */}
                {workingDays.map((day) => {
                  const summary = daySummaries[day.date]
                  const overThreshold = !day.isHoliday && summary.wfh > wfhThreshold
                  return (
                    <TableCell
                      key={day.date}
                      className={cn(
                        'px-1 py-1 text-center',
                        overThreshold && cn(STATUS_COLORS.violation.bg, STATUS_COLORS.violation.text, 'ring-2 ring-red-300 rounded')
                      )}
                    >
                      {day.isHoliday ? (
                        <span className="text-[9px] text-muted-foreground">PH</span>
                      ) : (
                        <div className="text-[9px] leading-tight">
                          <div className="text-green-700">{summary.office}O</div>
                          <div className="text-blue-700">{summary.wfh}W</div>
                        </div>
                      )}
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
        {(['office', 'wfh', 'public_holiday', 'vacation', 'sick_leave', 'not_scheduled'] as const).map(
          (status) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className={cn('inline-block h-3 w-3 rounded-full', STATUS_COLORS[status].dot)}
              />
              <span>{SCHEDULE_STATUS_LABELS[status]}</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}
