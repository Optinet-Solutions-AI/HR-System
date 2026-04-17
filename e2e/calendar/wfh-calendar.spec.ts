import { test, expect } from '@playwright/test'
import { AUTH_FILES } from '../fixtures/auth-files'

// ── employee4d: officeDaysPerWeek=4, wfhPerWeek=1 ───────────────────────────

test.describe('WFH calendar — employee with 4 office days/week', () => {
  test.use({ storageState: AUTH_FILES.employee4d })

  test('calendar grid renders for a future month', async ({ page }) => {
    await page.goto('/calendar?month=2027-03')
    await expect(page.getByText('March 2027')).toBeVisible()
    // Monday 1 March 2027 is the first day in the grid
    await expect(page.getByTestId('day-2027-03-01')).toBeVisible()
  })

  test('clicking an office day toggles it to WFH and marks 1 unsaved change', async ({ page }) => {
    await page.goto('/calendar?month=2027-03')
    // Tuesday 2 March 2027 — starts as Office
    await expect(page.getByTestId('day-2027-03-02')).toContainText('Office')
    await page.getByTestId('day-2027-03-02').click()
    await expect(page.getByTestId('day-2027-03-02')).toContainText('WFH')
    await expect(page.getByText('1 unsaved change')).toBeVisible()
  })

  test('clicking a WFH day toggles it back to Office and clears unsaved count', async ({ page }) => {
    await page.goto('/calendar?month=2027-03')
    await page.getByTestId('day-2027-03-02').click()
    await expect(page.getByTestId('day-2027-03-02')).toContainText('WFH')
    await page.getByTestId('day-2027-03-02').click()
    await expect(page.getByTestId('day-2027-03-02')).toContainText('Office')
    await expect(page.getByText('No changes')).toBeVisible()
  })

  test('exceeding weekly WFH limit (>1/week) shows toast and keeps day as Office', async ({ page }) => {
    // ISO week 14 of 2027: Mon 5 Apr – Fri 9 Apr
    // employee4d: wfhPerWeek=1, so after 1 WFH selection the week is at limit
    await page.goto('/calendar?month=2027-04')
    // Select Tuesday 6 April — first WFH in week 14 (within limit)
    await page.getByTestId('day-2027-04-06').click()
    await expect(page.getByTestId('day-2027-04-06')).toContainText('WFH')
    // Try Wednesday 7 April — second WFH in same week, blocked
    await page.getByTestId('day-2027-04-07').click()
    await expect(page.getByText('Maximum 1 WFH day per week reached.')).toBeVisible()
    await expect(page.getByTestId('day-2027-04-07')).toContainText('Office')
  })

  test('exceeding monthly Monday WFH limit shows toast and keeps day as Office', async ({ page }) => {
    // May 2027: Mon 3 May (week 18) and Mon 10 May (week 19)
    // schedule_rules row: MAX_WFH_PER_DAY_OF_WEEK Monday maxPerMonth=1 (seeded by seed.sql)
    await page.goto('/calendar?month=2027-05')
    // First Monday — weekly check passes (0 WFH in week 18), monthly Monday count = 1 ≤ 1 ✓
    await page.getByTestId('day-2027-05-03').click()
    await expect(page.getByTestId('day-2027-05-03')).toContainText('WFH')
    // Second Monday — weekly check passes (0 WFH in week 19), but monthly Monday count = 2 > 1 ✗
    await page.getByTestId('day-2027-05-10').click()
    await expect(page.getByText('Maximum 1 WFH Monday per month reached.')).toBeVisible()
    await expect(page.getByTestId('day-2027-05-10')).toContainText('Office')
  })

  test('Save Schedule saves to DB and shows success toast', async ({ page }) => {
    // Use a dedicated month so this test does not interfere with limit tests
    await page.goto('/calendar?month=2027-06')
    // Tuesday 1 June 2027 — toggle to WFH
    await page.getByTestId('day-2027-06-01').click()
    await expect(page.getByTestId('day-2027-06-01')).toContainText('WFH')
    await expect(page.getByText(/\d+ unsaved change/)).toBeVisible()
    await page.getByRole('button', { name: 'Save Schedule' }).click()
    await expect(page.getByText(/Schedule saved successfully/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('No changes')).toBeVisible()
  })
})

// ── employee5d: officeDaysPerWeek=5, calendar is read-only ───────────────────

test.describe('WFH calendar — employee with 5 office days/week (read-only)', () => {
  test.use({ storageState: AUTH_FILES.employee5d })

  test('read-only banner is visible', async ({ page }) => {
    await page.goto('/calendar?month=2027-05')
    await expect(page.getByText('Read-only schedule')).toBeVisible()
    await expect(page.getByText(/WFH is not available/)).toBeVisible()
  })

  test('day buttons are disabled', async ({ page }) => {
    await page.goto('/calendar?month=2027-05')
    // Tuesday 4 May 2027
    await expect(page.getByTestId('day-2027-05-04')).toBeDisabled()
  })

  test('Save Schedule button is not rendered', async ({ page }) => {
    await page.goto('/calendar?month=2027-05')
    await expect(page.getByRole('button', { name: 'Save Schedule' })).toHaveCount(0)
  })
})
