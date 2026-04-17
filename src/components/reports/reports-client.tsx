'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, subDays, isValid, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AttendanceTab } from './attendance-tab'
import { WfhUtilizationTab } from './wfh-utilization-tab'
import { MondayFridayTab } from './monday-friday-tab'
import {
  ClipboardCheck,
  Home,
  CalendarRange,
  CalendarDays,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'
import type {
  AttendanceRow,
  WfhByDayRow,
  WfhPerEmpRow,
  MonFriRow,
} from '@/lib/reports/transform'
import type { ReportTab } from '@/lib/types/app'

type Props = {
  from: string
  to: string
  tab: ReportTab
  attendanceRows: AttendanceRow[]
  wfhByDay: WfhByDayRow[]
  wfhPerEmp: WfhPerEmpRow[]
  monFriRows: MonFriRow[]
}

const TAB_CONFIG = [
  {
    value: 'attendance' as ReportTab,
    label: 'Attendance',
    description: 'Compliance rates & flag breakdown',
    icon: ClipboardCheck,
    accent: 'emerald',
  },
  {
    value: 'wfh' as ReportTab,
    label: 'WFH Utilization',
    description: 'Remote work patterns & entitlements',
    icon: Home,
    accent: 'blue',
  },
  {
    value: 'monday-friday' as ReportTab,
    label: 'Mon/Fri Analysis',
    description: 'Monday & Friday WFH violations',
    icon: CalendarRange,
    accent: 'amber',
  },
] as const

const ACCENT_STYLES = {
  emerald: {
    activeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    activeBorder: 'border-emerald-500',
    activeIcon: 'text-emerald-600 dark:text-emerald-400',
    activeText: 'text-emerald-900 dark:text-emerald-100',
    activeSub: 'text-emerald-600/80 dark:text-emerald-400/70',
    dot: 'bg-emerald-500',
  },
  blue: {
    activeBg: 'bg-blue-50 dark:bg-blue-950/40',
    activeBorder: 'border-blue-500',
    activeIcon: 'text-blue-600 dark:text-blue-400',
    activeText: 'text-blue-900 dark:text-blue-100',
    activeSub: 'text-blue-600/80 dark:text-blue-400/70',
    dot: 'bg-blue-500',
  },
  amber: {
    activeBg: 'bg-amber-50 dark:bg-amber-950/40',
    activeBorder: 'border-amber-500',
    activeIcon: 'text-amber-600 dark:text-amber-400',
    activeText: 'text-amber-900 dark:text-amber-100',
    activeSub: 'text-amber-600/80 dark:text-amber-400/70',
    dot: 'bg-amber-500',
  },
} as const

export function ReportsClient({
  from,
  to,
  tab,
  attendanceRows,
  wfhByDay,
  wfhPerEmp,
  monFriRows,
}: Props) {
  const router = useRouter()
  const [fromInput, setFromInput] = useState(from)
  const [toInput, setToInput] = useState(to)

  function navigate(newFrom: string, newTo: string, newTab?: ReportTab | string) {
    const params = new URLSearchParams({
      from: newFrom,
      to: newTo,
      tab: newTab ?? tab,
    })
    router.push(`/reports?${params.toString()}`)
  }

  function applyPreset(preset: 'thisMonth' | 'lastMonth' | 'last30') {
    const today = new Date()
    let newFrom: string
    let newTo: string

    if (preset === 'thisMonth') {
      newFrom = format(startOfMonth(today), 'yyyy-MM-dd')
      newTo = format(today, 'yyyy-MM-dd')
    } else if (preset === 'lastMonth') {
      const last = subMonths(today, 1)
      newFrom = format(startOfMonth(last), 'yyyy-MM-dd')
      newTo = format(endOfMonth(last), 'yyyy-MM-dd')
    } else {
      newFrom = format(subDays(today, 29), 'yyyy-MM-dd')
      newTo = format(today, 'yyyy-MM-dd')
    }

    setFromInput(newFrom)
    setToInput(newTo)
    navigate(newFrom, newTo)
  }

  function handleApply() {
    const parsedFrom = parseISO(fromInput)
    const parsedTo = parseISO(toInput)
    if (!isValid(parsedFrom) || !isValid(parsedTo) || parsedFrom > parsedTo) return
    navigate(fromInput, toInput)
  }

  function handleTabChange(newTab: ReportTab) {
    navigate(fromInput, toInput, newTab)
  }

  const presets = [
    { key: 'thisMonth' as const, label: 'This Month' },
    { key: 'lastMonth' as const, label: 'Last Month' },
    { key: 'last30' as const, label: 'Last 30 Days' },
  ]

  return (
    <div className="space-y-6">
      {/* Date range bar */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Period
            </span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {presets.map(p => (
              <Button
                key={p.key}
                variant="ghost"
                size="sm"
                onClick={() => applyPreset(p.key)}
                className="h-8 rounded-lg text-xs font-medium hover:bg-muted/80 whitespace-nowrap"
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:ml-auto">
            <div className="grid gap-1 flex-1 min-w-[120px]">
              <Label htmlFor="from" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                From
              </Label>
              <Input
                id="from"
                type="date"
                value={fromInput}
                onChange={e => setFromInput(e.target.value)}
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <ArrowRight className="mb-1.5 h-4 w-4 text-muted-foreground/50 hidden sm:block" />
            <div className="grid gap-1 flex-1 min-w-[120px]">
              <Label htmlFor="to" className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                To
              </Label>
              <Input
                id="to"
                type="date"
                value={toInput}
                onChange={e => setToInput(e.target.value)}
                className="h-8 rounded-lg text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              className="h-8 rounded-lg px-4 text-xs font-semibold"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {TAB_CONFIG.map(t => {
          const isActive = tab === t.value
          const styles = ACCENT_STYLES[t.accent]
          const Icon = t.icon

          return (
            <button
              key={t.value}
              onClick={() => handleTabChange(t.value)}
              className={`
                group relative flex items-start gap-3.5 rounded-xl border-2 p-4 text-left
                transition-all duration-200 ease-out
                ${isActive
                  ? `${styles.activeBg} ${styles.activeBorder} shadow-sm`
                  : 'border-transparent bg-muted/40 hover:bg-muted/70 hover:border-border/60'
                }
              `}
            >
              <div
                className={`
                  mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                  transition-colors duration-200
                  ${isActive
                    ? `${styles.activeBg} ${styles.activeIcon}`
                    : 'bg-muted text-muted-foreground group-hover:text-foreground/70'
                  }
                `}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                  )}
                  <span
                    className={`
                      text-sm font-semibold leading-tight
                      ${isActive ? styles.activeText : 'text-foreground/80 group-hover:text-foreground'}
                    `}
                  >
                    {t.label}
                  </span>
                </div>
                <p
                  className={`
                    mt-0.5 text-xs leading-snug
                    ${isActive ? styles.activeSub : 'text-muted-foreground'}
                  `}
                >
                  {t.description}
                </p>
              </div>
              <ChevronRight
                className={`
                  mt-1 h-4 w-4 shrink-0 transition-all duration-200
                  ${isActive
                    ? `${styles.activeIcon} translate-x-0 opacity-100`
                    : 'text-muted-foreground/0 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40'
                  }
                `}
              />
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:p-6">
        {tab === 'attendance' && (
          <AttendanceTab rows={attendanceRows} from={from} to={to} />
        )}
        {tab === 'wfh' && (
          <WfhUtilizationTab byDay={wfhByDay} perEmp={wfhPerEmp} from={from} to={to} />
        )}
        {tab === 'monday-friday' && (
          <MondayFridayTab rows={monFriRows} from={from} to={to} />
        )}
      </div>
    </div>
  )
}
