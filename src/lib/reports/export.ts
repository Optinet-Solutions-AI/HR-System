import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Converts an array of objects to a CSV file and triggers a browser download.
 * Only call from client components — uses browser DOM APIs.
 */
export function downloadCsv(rows: object[], filename: string): void {
  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Converts an array of objects to a PDF table and triggers a browser download.
 * Uses jsPDF + jspdf-autotable. Only call from client components.
 */
export function downloadPdf(
  rows: Record<string, string | number>[],
  filename: string,
  title?: string,
): void {
  if (rows.length === 0) return

  const doc = new jsPDF({ orientation: 'landscape' })

  if (title) {
    doc.setFontSize(14)
    doc.text(title, 14, 16)
  }

  const headers = Object.keys(rows[0])
  const body = rows.map(row => headers.map(h => String(row[h] ?? '')))

  autoTable(doc, {
    head: [headers],
    body,
    startY: title ? 22 : 14,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 51, 51] },
  })

  doc.save(filename)
}
