'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, subMonths, subDays, isValid, parseISO } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AttendanceTab } from './attendance-tab'
import { WfhUtilizationTab } from './wfh-utilization-tab'
import { MondayFridayTab } from './monday-friday-tab'
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

  function handleTabChange(newTab: string) {
    navigate(fromInput, toInput, newTab)
  }

  return (
    <div className="space-y-6">
      {/* Date range bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => applyPreset('thisMonth')}>
            This Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('lastMonth')}>
            Last Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset('last30')}>
            Last 30 Days
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="from"
              type="date"
              value={fromInput}
              onChange={e => setFromInput(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="to"
              type="date"
              value={toInput}
              onChange={e => setToInput(e.target.value)}
              className="h-8 w-36"
            />
          </div>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="wfh">WFH Utilization</TabsTrigger>
          <TabsTrigger value="monday-friday">Monday/Friday Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab rows={attendanceRows} from={from} to={to} />
        </TabsContent>

        <TabsContent value="wfh" className="mt-4">
          <WfhUtilizationTab byDay={wfhByDay} perEmp={wfhPerEmp} from={from} to={to} />
        </TabsContent>

        <TabsContent value="monday-friday" className="mt-4">
          <MondayFridayTab rows={monFriRows} from={from} to={to} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
