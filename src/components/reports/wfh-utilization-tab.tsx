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
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { WfhByDayRow, WfhPerEmpRow } from '@/lib/reports/transform'

type Props = {
  byDay: WfhByDayRow[]
  perEmp: WfhPerEmpRow[]
  from: string
  to: string
}

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

function InlineBar({ pct }: { pct: number }) {
  return (
    <div className="w-40 bg-gray-100 rounded-full h-2">
      <div
        className="bg-blue-500 h-2 rounded-full"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

export function WfhUtilizationTab({ byDay, perEmp, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const perEmpColumns: ColumnDef<WfhPerEmpRow>[] = [
    {
      id: 'name',
      accessorFn: row => `${row.last_name}, ${row.first_name}`,
      header: ({ column }) => <SortButton column={column}>Employee</SortButton>,
      cell: ({ row }) => `${row.original.first_name} ${row.original.last_name}`,
    },
    {
      accessorKey: 'wfh_days',
      header: ({ column }) => <SortButton column={column}>WFH Days</SortButton>,
    },
    {
      accessorKey: 'total_wfh_entitlement',
      header: 'Entitlement',
    },
    {
      accessorKey: 'utilisation_rate',
      header: ({ column }) => <SortButton column={column}>Utilisation</SortButton>,
      cell: ({ row }) => `${row.original.utilisation_rate.toFixed(1)}%`,
    },
  ]

  const table = useReactTable({
    data: perEmp,
    columns: perEmpColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  function handleExport() {
    const popularCsv = Papa.unparse(
      byDay.map(r => ({
        Day: r.day,
        'WFH Days': r.wfh_count,
        '% of Total': r.pct_of_total,
      })),
    )
    const empCsv = Papa.unparse(
      perEmp.map(r => ({
        Employee: `${r.first_name} ${r.last_name}`,
        'WFH Days': r.wfh_days,
        Entitlement: r.total_wfh_entitlement,
        'Utilisation %': r.utilisation_rate,
      })),
    )
    const combined = `Popular Days\n${popularCsv}\n\nPer Employee\n${empCsv}`
    const blob = new Blob([combined], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `wfh_utilization_${from}_${to}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Section A: Popular Days */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Popular WFH Days</h3>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>WFH Days</TableHead>
                <TableHead>% of Total</TableHead>
                <TableHead>Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byDay.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No WFH data for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                byDay.map(row => (
                  <TableRow key={row.day}>
                    <TableCell className="font-medium">{row.day}</TableCell>
                    <TableCell>{row.wfh_count}</TableCell>
                    <TableCell>{row.pct_of_total}%</TableCell>
                    <TableCell>
                      <InlineBar pct={row.pct_of_total} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Section B: Per Employee */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold">Per Employee</h3>
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
                    colSpan={perEmpColumns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No WFH schedules for the selected period.
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
    </div>
  )
}
