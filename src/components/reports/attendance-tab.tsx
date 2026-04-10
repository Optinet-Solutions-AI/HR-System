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
import { useState } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
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
import { downloadCsv } from '@/lib/reports/export'

type Props = { rows: AttendanceRow[]; from: string; to: string }

function SortButton<T>({
  column,
  children,
}: {
  column: Column<T>
  children: React.ReactNode
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

export function AttendanceTab({ rows, from, to }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<AttendanceRow>[] = [
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
    onSortingChange: setSorting,
    state: { sorting },
  })

  const overallRate =
    rows.length > 0
      ? Math.round(
          (rows.reduce((s, r) => s + r.compliance_rate, 0) / rows.length) * 10,
        ) / 10
      : 0
  const flaggedCount = rows.filter(r => r.total_days - r.compliant_days > 0).length

  function handleExport() {
    const exportRows = rows.map(r => ({
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
    downloadCsv(exportRows, `attendance_${from}_${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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

      <div className="flex justify-end">
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
                  No compliance data for the selected period.
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
