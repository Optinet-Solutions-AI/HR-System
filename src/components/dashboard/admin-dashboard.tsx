'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Building2,
  Home,
  Clock,
  Palmtree,
  AlertTriangle,
  Search,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { transformDashboardData } from '@/lib/dashboard/transform'
import {
  STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  ACTUAL_STATUS_LABELS,
  ACTUAL_STATUS_COLOR_MAP,
  COMPLIANCE_FLAG_LABELS,
} from '@/lib/constants'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { DashboardData, DashboardEmployeeRow } from '@/lib/types/app'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Status Cards
// ---------------------------------------------------------------------------

const STATUS_CARD_CONFIG = [
  {
    key: 'inOffice' as const,
    label: 'In Office',
    icon: Building2,
    colorKey: 'office' as const,
  },
  {
    key: 'wfh' as const,
    label: 'WFH',
    icon: Home,
    colorKey: 'wfh' as const,
  },
  {
    key: 'notClocked' as const,
    label: 'Not Clocked',
    icon: Clock,
    colorKey: 'unknown' as const,
  },
  {
    key: 'onLeave' as const,
    label: 'On Leave',
    icon: Palmtree,
    colorKey: 'vacation' as const,
  },
  {
    key: 'flagged' as const,
    label: 'Flagged',
    icon: AlertTriangle,
    colorKey: 'violation' as const,
  },
] as const

function StatusCards({
  counts,
}: {
  counts: DashboardData['counts']
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
      {STATUS_CARD_CONFIG.map(({ key, label, icon: Icon, colorKey }) => {
        const colors = STATUS_COLORS[colorKey]
        return (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{label}</CardDescription>
              <Icon className={cn('h-4 w-4', colors.text)} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', colors.dot)} />
                <span className="text-2xl font-bold">{counts[key]}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<DashboardEmployeeRow>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.firstName} ${row.lastName}`,
    header: ({ column }) => (
      <button
        className="flex items-center gap-1 font-medium hover:text-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name
        <ArrowUpDown className="h-3 w-3" />
      </button>
    ),
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  {
    accessorKey: 'expectedStatus',
    header: 'Expected',
    cell: ({ getValue }) => {
      const status = getValue<string | null>()
      if (!status) return <span className="text-muted-foreground">—</span>
      const colorKey = status as keyof typeof STATUS_COLORS
      const colors = STATUS_COLORS[colorKey] ?? STATUS_COLORS.unknown
      return (
        <Badge className={cn(colors.bg, colors.text, 'border-0')}>
          {SCHEDULE_STATUS_LABELS[status] ?? status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'actualStatus',
    header: 'Actual',
    cell: ({ getValue }) => {
      const status = getValue<string | null>()
      if (!status) return <span className="text-muted-foreground">—</span>
      const colorKey = ACTUAL_STATUS_COLOR_MAP[status] ?? 'unknown'
      const colors = STATUS_COLORS[colorKey]
      return (
        <Badge className={cn(colors.bg, colors.text, 'border-0')}>
          {ACTUAL_STATUS_LABELS[status] ?? status}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'timeIn',
    header: 'Clock In',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? (
        <span className="font-mono text-sm">{val}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  },
  {
    accessorKey: 'timeOut',
    header: 'Clock Out',
    cell: ({ getValue }) => {
      const val = getValue<string | null>()
      return val ? (
        <span className="font-mono text-sm">{val}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  },
  {
    accessorKey: 'flags',
    header: 'Flags',
    cell: ({ getValue }) => {
      const flags = getValue<string[]>()
      if (!flags || flags.length === 0) return null
      return (
        <div className="flex flex-wrap gap-1">
          {flags.map((flag) => (
            <Badge
              key={flag}
              variant="destructive"
              className="text-xs"
            >
              {COMPLIANCE_FLAG_LABELS[flag] ?? flag}
            </Badge>
          ))}
        </div>
      )
    },
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface AdminDashboardProps {
  initialData: DashboardData
}

export function AdminDashboard({ initialData }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refetchDashboardData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const [empRes, schRes, clkRes, cmpRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('is_active', true)
          .order('last_name'),
        supabase
          .from('schedules')
          .select('employee_id, status')
          .eq('date', data.todayDate),
        supabase
          .from('clockings')
          .select('employee_id, time_in, time_out')
          .eq('date', data.todayDate),
        supabase
          .from('compliance_records')
          .select('employee_id, actual_status, is_compliant, flags, expected_status')
          .eq('date', data.todayDate),
      ])

      const error = empRes.error ?? schRes.error ?? clkRes.error ?? cmpRes.error
      if (error) return

      const newData = transformDashboardData(
        empRes.data ?? [],
        schRes.data ?? [],
        clkRes.data ?? [],
        cmpRes.data ?? [],
        data.todayDate,
      )
      setData(newData)
    } finally {
      setIsRefreshing(false)
    }
  }, [data.todayDate])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const debouncedRefetch = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        refetchDashboardData()
      }, 500)
    }

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clockings', filter: `date=eq.${data.todayDate}` },
        debouncedRefetch,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compliance_records',
          filter: `date=eq.${data.todayDate}`,
        },
        debouncedRefetch,
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [data.todayDate, refetchDashboardData])

  const table = useReactTable({
    data: data.employees,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase()
      const name = `${row.original.firstName} ${row.original.lastName}`.toLowerCase()
      return name.includes(search)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <StatusCards counts={data.counts} />

      {/* Employee Status Table */}
      <div>
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} employee
              {table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
            </span>
            {isRefreshing && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="rounded-lg border min-w-[600px]">
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </div>
      </div>
    </div>
  )
}
