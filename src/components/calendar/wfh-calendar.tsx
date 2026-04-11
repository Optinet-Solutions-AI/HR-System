'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  getISOWeek,
  isMonday,
  isFriday,
  addMonths,
  subMonths,
} from 'date-fns'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Save, RotateCcw, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Schedule, PublicHoliday, ScheduleRule, ScheduleStatus } from '@/lib/types/app'
import type { ValidationViolation } from '@/lib/schedules/validation'

interface WfhCalendarProps {
  employeeId: string
  officeDaysPerWeek: number
  month: string
  initialSchedules: Schedule[]
  publicHolidays: PublicHoliday[]
  scheduleRules: ScheduleRule[]
}

type DayStatus = 'office' | 'wfh'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function WfhCalendar({
  officeDaysPerWeek,
  month,
  initialSchedules,
  publicHolidays,
  scheduleRules,
}: WfhCalendarProps) {
  const router = useRouter()
  const wfhPerWeek = 5 - officeDaysPerWeek
  const isReadOnly = officeDaysPerWeek === 5

  const holidayDates = useMemo(
    () => new Map(publicHolidays.map((h) => [h.date, h.name])),
    [publicHolidays]
  )

  const monthDate = parseISO(`${month}-01`)
  const monthLabel = format(monthDate, 'MMMM yyyy')

  // Build the calendar grid structure
  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const weeks: Array<{
      weekNumber: number
      days: Array<{
        date: Date
        dateStr: string
        dayOfMonth: number
        isWeekend: boolean
        isHoliday: boolean
        holidayName?: string
        gridColumn: number // 1-5 for Mon-Fri
      } | null>
    }> = []

    let currentWeekNumber = -1
    let currentWeek: typeof weeks[number] | null = null

    for (const day of allDays) {
      const dayOfWeek = getDay(day) // 0=Sun, 6=Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) continue // Skip weekends

      const weekNum = getISOWeek(day)
      const dateStr = format(day, 'yyyy-MM-dd')
      const gridColumn = dayOfWeek // Mon=1, Fri=5

      if (weekNum !== currentWeekNumber) {
        currentWeek = { weekNumber: weekNum, days: [null, null, null, null, null] }
        weeks.push(currentWeek)
        currentWeekNumber = weekNum
      }

      currentWeek!.days[gridColumn - 1] = {
        date: day,
        dateStr,
        dayOfMonth: day.getDate(),
        isWeekend: false,
        isHoliday: holidayDates.has(dateStr),
        holidayName: holidayDates.get(dateStr),
        gridColumn,
      }
    }

    return weeks
  }, [monthDate, holidayDates])

  // Initialize selections from existing schedules
  const buildInitialSelections = useCallback((): Map<string, DayStatus> => {
    const scheduleMap = new Map(
      initialSchedules.map((s) => [s.date, s.status as ScheduleStatus])
    )
    const map = new Map<string, DayStatus>()

    for (const week of calendarWeeks) {
      for (const day of week.days) {
        if (!day || day.isHoliday) continue
        const existing = scheduleMap.get(day.dateStr)
        map.set(day.dateStr, existing === 'wfh' ? 'wfh' : 'office')
      }
    }
    return map
  }, [calendarWeeks, initialSchedules])

  const [daySelections, setDaySelections] = useState<Map<string, DayStatus>>(
    () => buildInitialSelections()
  )
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationViolation[]>([])

  // Count unsaved changes — hasChanges derived from this so toggling back to original shows "No changes"
  const changeCount = useMemo(() => {
    const initial = buildInitialSelections()
    let count = 0
    daySelections.forEach((status, dateStr) => {
      if (initial.get(dateStr) !== status) count++
    })
    return count
  }, [daySelections, buildInitialSelections])

  const hasChanges = changeCount > 0

  // Warn on unsaved changes before leaving
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  // Get WFH counts per week
  const weekWfhCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const week of calendarWeeks) {
      let wfhCount = 0
      for (const day of week.days) {
        if (!day || day.isHoliday) continue
        if (daySelections.get(day.dateStr) === 'wfh') wfhCount++
      }
      counts.set(week.weekNumber, wfhCount)
    }
    return counts
  }, [calendarWeeks, daySelections])

  // Count Monday/Friday WFH for the month
  const mondayFridayCounts = useMemo(() => {
    let mondays = 0
    let fridays = 0
    daySelections.forEach((status, dateStr) => {
      if (status !== 'wfh') return
      const date = parseISO(dateStr)
      if (isMonday(date)) mondays++
      if (isFriday(date)) fridays++
    })
    return { mondays, fridays }
  }, [daySelections])

  // Get Monday/Friday limits from rules
  const mondayFridayLimits = useMemo(() => {
    let monday = 1
    let friday = 1
    for (const rule of scheduleRules) {
      if (rule.rule_type !== 'MAX_WFH_PER_DAY_OF_WEEK' || !rule.is_active) continue
      const value = rule.value as { dayOfWeek?: string; maxPerMonth?: number }
      if (value.dayOfWeek === 'Monday' && typeof value.maxPerMonth === 'number') {
        monday = value.maxPerMonth
      }
      if (value.dayOfWeek === 'Friday' && typeof value.maxPerMonth === 'number') {
        friday = value.maxPerMonth
      }
    }
    return { monday, friday }
  }, [scheduleRules])

  const handleToggleDay = useCallback(
    (dateStr: string) => {
      if (isReadOnly) return

      const current = daySelections.get(dateStr)
      if (!current) return

      const newStatus: DayStatus = current === 'office' ? 'wfh' : 'office'

      if (newStatus === 'wfh') {
        // Check week limit
        const date = parseISO(dateStr)
        const weekNum = getISOWeek(date)
        const currentWeekWfh = weekWfhCounts.get(weekNum) ?? 0
        if (currentWeekWfh >= wfhPerWeek) {
          toast.error(`Maximum ${wfhPerWeek} WFH day${wfhPerWeek !== 1 ? 's' : ''} per week reached.`)
          return
        }

        // Check Monday/Friday limit
        if (isMonday(date) && mondayFridayCounts.mondays >= mondayFridayLimits.monday) {
          toast.error(`Maximum ${mondayFridayLimits.monday} WFH Monday${mondayFridayLimits.monday !== 1 ? 's' : ''} per month reached.`)
          return
        }
        if (isFriday(date) && mondayFridayCounts.fridays >= mondayFridayLimits.friday) {
          toast.error(`Maximum ${mondayFridayLimits.friday} WFH Friday${mondayFridayLimits.friday !== 1 ? 's' : ''} per month reached.`)
          return
        }
      }

      setDaySelections((prev) => {
        const next = new Map(prev)
        next.set(dateStr, newStatus)
        return next
      })
      setValidationErrors([])
    },
    [isReadOnly, daySelections, weekWfhCounts, wfhPerWeek, mondayFridayCounts, mondayFridayLimits]
  )

  const handleReset = useCallback(() => {
    setDaySelections(buildInitialSelections())
    setValidationErrors([])
  }, [buildInitialSelections])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setValidationErrors([])

    try {
      const selections = Array.from(daySelections.entries()).map(([date, status]) => ({
        date,
        status,
      }))

      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, selections }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please log in again.')
          router.push('/login')
          return
        }
        if (result.violations) {
          setValidationErrors(result.violations)
          toast.error('Validation failed. Please fix the errors below.')
          return
        }
        toast.error(result.error || 'Failed to save schedule.')
        return
      }

      toast.success(`Schedule saved successfully (${result.data.saved} days).`)
      router.refresh()
    } catch {
      toast.error('Failed to save. Please check your connection and try again.')
    } finally {
      setIsSaving(false)
    }
  }, [daySelections, month, router])

  // Month navigation
  const prevMonth = format(subMonths(monthDate, 1), 'yyyy-MM')
  const nextMonth = format(addMonths(monthDate, 1), 'yyyy-MM')

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">WFH Calendar</h1>
      </div>

      {isReadOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Read-only schedule</p>
            <p className="text-sm mt-1">
              Your schedule requires 5 office days per week. WFH is not available.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => router.push(`/calendar?month=${prevMonth}`)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg">{monthLabel}</CardTitle>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => router.push(`/calendar?month=${nextMonth}`)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isReadOnly && (
              <CardDescription>
                Up to {wfhPerWeek} WFH day{wfhPerWeek !== 1 ? 's' : ''} per week
              </CardDescription>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-full', STATUS_COLORS.office.dot)} />
              <span>Office</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-full', STATUS_COLORS.wfh.dot)} />
              <span>WFH</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('h-3 w-3 rounded-full', STATUS_COLORS.public_holiday.dot)} />
              <span>Public Holiday</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-5 bg-muted/50 border-b">
              {WEEKDAY_HEADERS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Week rows */}
            {calendarWeeks.map((week) => {
              const wfhCount = weekWfhCounts.get(week.weekNumber) ?? 0
              return (
                <div key={week.weekNumber}>
                  <div className="grid grid-cols-5 border-b last:border-b-0">
                    {week.days.map((day, idx) => {
                      if (!day) {
                        return (
                          <div
                            key={idx}
                            className="min-h-[72px] border-r last:border-r-0 bg-muted/20"
                          />
                        )
                      }

                      if (day.isHoliday) {
                        return (
                          <div
                            key={day.dateStr}
                            className={cn(
                              'min-h-[72px] border-r last:border-r-0 p-2 flex flex-col',
                              STATUS_COLORS.public_holiday.bg
                            )}
                          >
                            <span className={cn('text-xs font-medium', STATUS_COLORS.public_holiday.text)}>
                              {day.dayOfMonth}
                            </span>
                            <span className={cn('text-[10px] mt-auto leading-tight', STATUS_COLORS.public_holiday.text)}>
                              {day.holidayName}
                            </span>
                          </div>
                        )
                      }

                      const status = daySelections.get(day.dateStr) ?? 'office'
                      const colors = STATUS_COLORS[status]
                      const isSelectable = !isReadOnly

                      return (
                        <button
                          key={day.dateStr}
                          type="button"
                          data-testid={`day-${day.dateStr}`}
                          disabled={!isSelectable}
                          onClick={() => handleToggleDay(day.dateStr)}
                          className={cn(
                            'min-h-[72px] border-r last:border-r-0 p-2 flex flex-col text-left transition-colors duration-150',
                            colors.bg,
                            isSelectable && 'hover:ring-2 hover:ring-primary/30 hover:ring-inset cursor-pointer',
                            !isSelectable && 'cursor-default'
                          )}
                        >
                          <span className={cn('text-xs font-medium', colors.text)}>
                            {day.dayOfMonth}
                          </span>
                          <span className={cn('text-[11px] mt-auto font-medium', colors.text)}>
                            {status === 'wfh' ? 'WFH' : 'Office'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {/* Week summary */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-end px-3 py-1 bg-muted/30 border-b last:border-b-0">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          wfhCount >= wfhPerWeek
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        WFH: {wfhCount}/{wfhPerWeek}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/50">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Validation errors:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        {!isReadOnly && (
          <CardFooter className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {hasChanges
                ? `${changeCount} unsaved change${changeCount !== 1 ? 's' : ''}`
                : 'No changes'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                )}
                Save Schedule
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
