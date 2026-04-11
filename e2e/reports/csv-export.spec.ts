import { test, expect } from '@playwright/test'
import { format, startOfMonth } from 'date-fns'
import { AUTH_FILES } from '../fixtures/auth-files'

test.describe('reports page — CSV export', () => {
  test.use({ storageState: AUTH_FILES.hradmin })

  test('renders Attendance, WFH Utilization, and Monday/Friday Analysis tabs', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('tab', { name: 'Attendance' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'WFH Utilization' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Monday/Friday Analysis' })).toBeVisible()
  })

  test('Export CSV button on Attendance tab triggers a .csv download', async ({ page }) => {
    await page.goto('/reports')
    // Attendance tab is active by default
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export CSV/i }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.csv$/)
  })

  test('GET /api/reports/export returns 200 with CSV headers', async ({ page }) => {
    const today = new Date()
    const from = format(startOfMonth(today), 'yyyy-MM-dd')
    const to   = format(today, 'yyyy-MM-dd')

    // page.request shares auth cookies from the hradmin storageState
    const response = await page.request.get(
      `/api/reports/export?type=attendance&from=${from}&to=${to}&format=csv`,
    )

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/csv')
    expect(response.headers()['content-disposition']).toContain('attachment')
    expect(response.headers()['content-disposition']).toContain('.csv')
  })
})
