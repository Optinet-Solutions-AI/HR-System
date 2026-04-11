import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import Papa from 'papaparse'
import { getDay, parseISO } from 'date-fns'

const QuerySchema = z.object({
  type: z.enum(['attendance', 'wfh', 'monday-friday']),
  from: z.string().date(),
  to: z.string().date(),
  format: z.enum(['csv', 'pdf']),
})

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type RecordRow = {
  id: string
  employee_id: string
  date: string
  week_number: number
  expected_status: string | null
  actual_status: string
  has_clocking: boolean
  has_booking: boolean
  location_match: boolean | null
  is_compliant: boolean
  flags: string[] | null
  employees: { first_name: string; last_name: string } | null
}

function employeeName(r: RecordRow): string {
  return r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : r.employee_id
}

function dayName(dateStr: string): string {
  return DAY_NAMES[getDay(parseISO(dateStr))]
}

function filterByType(records: RecordRow[], type: string): RecordRow[] {
  if (type === 'wfh') {
    return records.filter(r => r.expected_status === 'wfh' || r.actual_status === 'wfh_confirmed')
  }
  if (type === 'monday-friday') {
    return records.filter(r => {
      const d = getDay(parseISO(r.date))
      return d === 1 || d === 5
    })
  }
  return records
}

function shapeData(records: RecordRow[], type: string) {
  const title =
    type === 'wfh' ? 'WFH Report'
    : type === 'monday-friday' ? 'Monday / Friday WFH Report'
    : 'Attendance Report'

  if (type === 'wfh' || type === 'monday-friday') {
    const headers = ['Employee', 'Date', 'Day', 'Expected', 'Actual', 'WFH Confirmed', 'Compliant', 'Flags']
    const rows = records.map(r => [
      employeeName(r),
      r.date,
      dayName(r.date),
      r.expected_status ?? '—',
      r.actual_status,
      r.actual_status === 'wfh_confirmed' ? 'Yes' : 'No',
      r.is_compliant ? 'Yes' : 'No',
      r.flags?.join(', ') ?? '',
    ])
    return { title, headers, rows }
  }

  const headers = ['Employee', 'Date', 'Day', 'Expected', 'Actual', 'Clocking', 'Booking', 'Location Match', 'Compliant', 'Flags']
  const rows = records.map(r => [
    employeeName(r),
    r.date,
    dayName(r.date),
    r.expected_status ?? '—',
    r.actual_status,
    r.has_clocking ? 'Yes' : 'No',
    r.has_booking ? 'Yes' : 'No',
    r.location_match === null ? '—' : r.location_match ? 'Yes' : 'No',
    r.is_compliant ? 'Yes' : 'No',
    r.flags?.join(', ') ?? '',
  ])
  return { title, headers, rows }
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee || !['hr_admin', 'super_admin', 'manager'].includes(employee.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, from, to, format } = parsed.data

  const { data: records, error } = await supabase
    .from('compliance_records')
    .select('*, employees!employee_id(first_name, last_name)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const filtered = filterByType((records ?? []) as RecordRow[], type)
  const { title, headers, rows } = shapeData(filtered, type)
  const filename = `${type}-report-${from}-to-${to}`

  if (format === 'csv') {
    const csv = Papa.unparse({ fields: headers, data: rows })
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  }

  // PDF
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.text(`Period: ${from} to ${to}`, 14, 23)

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 175] },
  })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}
