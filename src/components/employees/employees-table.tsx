'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Pencil, Search, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EditEmployeeDialog } from '@/components/employees/edit-employee-dialog'
import type { Employee } from '@/lib/types/app'

const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  hr_admin: 'bg-yellow-100 text-yellow-800',
  super_admin: 'bg-red-100 text-red-800',
}

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hr_admin: 'HR Admin',
  super_admin: 'Super Admin',
}

const columns: ColumnDef<Employee>[] = [
  {
    id: 'name',
    accessorFn: (row) => `${row.first_name} ${row.last_name}`,
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Name
        <ArrowUpDown className="ml-1 size-3" />
      </Button>
    ),
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'talexio_id',
    header: 'Talexio ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string | null>() ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'office_days_per_week',
    header: 'Office Days/Week',
    cell: ({ getValue }) => (
      <span className="text-center block">{getValue<number>()}</span>
    ),
  },
  {
    id: 'wfh_days',
    accessorFn: (row) => 5 - row.office_days_per_week,
    header: 'WFH Days/Week',
    cell: ({ getValue }) => (
      <span className="text-center block">{getValue<number>()}</span>
    ),
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ getValue }) => {
      const role = getValue<string>()
      return (
        <Badge className={ROLE_COLORS[role]}>
          {ROLE_LABELS[role] ?? role}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'is_active',
    header: 'Active',
    cell: ({ getValue }) => {
      const active = getValue<boolean>()
      return (
        <Badge className={active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ getValue }) => {
      const notes = getValue<string | null>()
      if (!notes) return <span className="text-muted-foreground">—</span>
      const truncated = notes.length > 50 ? `${notes.slice(0, 50)}...` : notes
      return <span title={notes}>{truncated}</span>
    },
  },
]

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  const table = useReactTable({
    data: employees,
    columns: [
      ...columns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditingEmployee(row.original)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ),
      },
    ],
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase()
      const name = `${row.original.first_name} ${row.original.last_name}`.toLowerCase()
      const talexioId = (row.original.talexio_id ?? '').toLowerCase()
      return name.includes(search) || talexioId.includes(search)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or Talexio ID..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} employee{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-lg border">
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
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditEmployeeDialog
        employee={editingEmployee}
        open={editingEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEmployee(null)
        }}
      />
    </>
  )
}
