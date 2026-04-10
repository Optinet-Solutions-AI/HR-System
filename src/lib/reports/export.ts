import Papa from 'papaparse'

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
