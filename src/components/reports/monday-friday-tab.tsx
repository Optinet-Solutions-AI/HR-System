'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Column,
} from '@tanstack/react-table'
import { useState, type ReactNode } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MonFriRow } from '@/lib/reports/transform'
import { downloadCsv } from '@/lib/reports/export'

type Props = { rows: MonFriRow[]; from: string; to: string }

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

export function MondayFridayTab({ rows, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<MonFriRow>[] = [
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'month',
      header: ({ column }) => <SortButton column={column}>Month</SortButton>,
    },
    {
      accessorKey: 'monday_wfh',
      header: ({ column }) => <SortButton column={column}>Mon WFH</SortButton>,
    },
    {
      accessorKey: 'friday_wfh',
      header: ({ column }) => <SortButton column={column}>Fri WFH</SortButton>,
    },
    {
      accessorKey: 'violation_count',
      header: ({ column }) => <SortButton column={column}>Total</SortButton>,
    },
    {
      accessorKey: 'violation_dates',
      header: 'Dates',
      cell: ({ row }) =>
        row.original.violation_dates
          .map(d => {
            const [y, m, day] = d.split('-').map(Number)
            return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          })
          .join(', '),
    },
  ]

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  const totalViolations = rows.length

  function handleExport() {
    const exportRows = rows.map(r => ({
      Employee: `${r.first_name} ${r.last_name}`,
      Month: r.month,
      'Monday WFH Count': r.monday_wfh,
      'Friday WFH Count': r.friday_wfh,
      'Total Violations': r.violation_count,
      'Violation Dates': r.violation_dates.join(', '),
    }))
    downloadCsv(exportRows, `monday_friday_violations_${from}_${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Card className="inline-flex">
          <CardContent className="flex items-center gap-4 pt-6 pb-6 px-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Violations</p>
              <p className="text-3xl font-bold">{totalViolations}</p>
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-md border">
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
                  No Mon/Fri rule violations for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
