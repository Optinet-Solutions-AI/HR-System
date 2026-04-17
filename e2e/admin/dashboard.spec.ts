import { test, expect } from '@playwright/test'
import { AUTH_FILES } from '../fixtures/auth-files'

test.describe('admin dashboard', () => {
  test.use({
    storageState: AUTH_FILES.hradmin,
    viewport: { width: 1280, height: 720 }, // ensures desktop sidebar is visible
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('renders a date subheading in the expected format', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // Verify a date subheading is present (format: "Saturday, 11 April 2026")
    await expect(page.getByText(/\w+day, \d+ \w+ \d{4}/)).toBeVisible()
  })

  test('sidebar shows all 6 nav links', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Employees' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Calendar' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Compliance' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rules' }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reports' }).first()).toBeVisible()
  })

  test('clicking Employees navigates to /employees', async ({ page }) => {
    await page.getByRole('link', { name: 'Employees' }).first().click()
    await expect(page).toHaveURL('/employees')
  })

  test('clicking Compliance navigates to /admin/compliance', async ({ page }) => {
    await page.getByRole('link', { name: 'Compliance' }).first().click()
    await expect(page).toHaveURL('/admin/compliance')
  })

  test('clicking Reports navigates to /reports', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports' }).first().click()
    await expect(page).toHaveURL('/reports')
  })

  test('clicking Dashboard from another page returns to /admin/dashboard', async ({ page }) => {
    await page.goto('/reports')
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page).toHaveURL('/admin/dashboard')
  })
})
