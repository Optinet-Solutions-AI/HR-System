'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
  type Column,
} from '@tanstack/react-table'
import React, { useState, type ReactNode } from 'react'
import { ArrowUpDown, Download, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AttendanceRow } from '@/lib/reports/transform'
import { downloadCsv, downloadPdf } from '@/lib/reports/export'
import { useEmployeeClockings } from './use-employee-clockings'
import { ExpandedClockingContent } from './expanded-clocking-content'
import { cn } from '@/lib/utils'

type Props = { rows: AttendanceRow[]; from: string; to: string }

function SortButton<T>({
  column,
  children,
}: {
  column: Column<T>
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting()}
      className="-ml-3"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

function RateBadge({ rate }: { rate: number }) {
  const cls =
    rate >= 90
      ? 'bg-green-100 text-green-800'
      : rate >= 70
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800'
  return <Badge className={cls}>{rate}%</Badge>
}

function ExpandedClockingRow({ row, from, to }: { row: AttendanceRow; from: string; to: string }) {
  const { data, isLoading, error } = useEmployeeClockings(row.employee_id, from, to, true)

  if (error) return <div className="p-4 text-destructive text-sm">{error}</div>

  return (
    <ExpandedClockingContent
      employeeName={`${row.first_name} ${row.last_name}`}
      businessUnit={row.business_unit}
      clockings={data ?? []}
      from={from}
      to={to}
      isLoading={isLoading}
    />
  )
}

export function AttendanceTab({ rows, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => (
        <button
          className="p-1 rounded hover:bg-muted"
          onClick={row.getToggleExpandedHandler()}
          aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              row.getIsExpanded() && 'rotate-90',
            )}
          />
        </button>
      ),
      size: 40,
    },
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'total_days',
      header: ({ column }) => <SortButton column={column}>Total Days</SortButton>,
    },
    {
      accessorKey: 'compliant_days',
      header: ({ column }) => <SortButton column={column}>Compliant</SortButton>,
    },
    {
      accessorKey: 'compliance_rate',
      header: ({ column }) => <SortButton column={column}>Rate</SortButton>,
      cell: ({ row }) => <RateBadge rate={row.original.compliance_rate} />,
    },
    {
      accessorKey: 'most_common_flag',
      header: 'Top Flag',
      cell: ({ row }) =>
        row.original.most_common_flag ? (
          <Badge variant="outline" className="font-normal">
            {row.original.most_common_flag.replace(/_/g, ' ')}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    state: { sorting, expanded },
  })

  const totalDays = rows.reduce((s, r) => s + r.total_days, 0)
  const totalCompliant = rows.reduce((s, r) => s + r.compliant_days, 0)
  const overallRate =
    totalDays > 0 ? Math.round((totalCompliant / totalDays) * 1000) / 10 : 0
  const flaggedCount = rows.filter(r => r.total_days - r.compliant_days > 0).length

  function getExportRows() {
    return rows.map(r => ({
      Employee: `${r.first_name} ${r.last_name}`,
      'Total Days': r.total_days,
      'Compliant Days': r.compliant_days,
      'Non-Compliant Days': r.total_days - r.compliant_days,
      'Compliance Rate %': r.compliance_rate,
      Flags:
        Object.entries(r.flag_counts)
          .map(([f, c]) => `${f}×${c}`)
          .join('; ') || '',
    }))
  }

  function handleExportCsv() {
    downloadCsv(getExportRows(), `attendance_${from}_${to}.csv`)
  }

  function handleExportPdf() {
    downloadPdf(getExportRows(), `attendance_${from}_${to}.pdf`, `Attendance Report (${from} — ${to})`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Overall Compliance Rate</p>
            <p className="text-3xl font-bold">{overallRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Employees with Violations</p>
            <p className="text-3xl font-bold">{flaggedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Download className="mr-2 h-4 w-4" />
          PDF
        </Button>
      </div>

      <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
      <div className="rounded-md border min-w-[500px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id}>
                {hg.headers.map(h => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No compliance data for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <React.Fragment key={row.id}>
                  <TableRow aria-expanded={row.getIsExpanded() || undefined}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-0">
                        <ExpandedClockingRow row={row.original} from={from} to={to} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      </div>
    </div>
  )
}
