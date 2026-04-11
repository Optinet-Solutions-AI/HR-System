import { test, expect } from '@playwright/test'
import { AUTH_FILES } from '../fixtures/auth-files'
import { TEST_USERS } from '../fixtures/test-users'

// ── Unauthenticated: login form behaviour ─────────────────────────────────────

test.describe('login form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/login')
  })

  test('valid employee credentials redirect to /calendar', async ({ page }) => {
    await page.getByLabel('Email').fill(TEST_USERS.employee4d.email)
    await page.getByLabel('Password').fill(TEST_USERS.employee4d.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/calendar', { timeout: 15_000 })
  })

  test('valid hr_admin credentials redirect to /admin/dashboard', async ({ page }) => {
    await page.getByLabel('Email').fill(TEST_USERS.hradmin.email)
    await page.getByLabel('Password').fill(TEST_USERS.hradmin.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/admin/dashboard', { timeout: 15_000 })
  })

  test('wrong password shows toast error and stays on /login', async ({ page }) => {
    await page.getByLabel('Email').fill(TEST_USERS.employee4d.email)
    await page.getByLabel('Password').fill('wrong-password-xyz')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({
      timeout: 5_000,
    })
    await expect(page).toHaveURL('/login')
  })
})

// ── Unauthenticated: middleware guards ────────────────────────────────────────

test.describe('middleware guards', () => {
  test('unauthenticated GET /calendar redirects to /login', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page).toHaveURL('/login')
  })

  test('unauthenticated GET /admin/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL('/login')
  })
})

// ── Authenticated as employee: admin route guard ──────────────────────────────

test.describe('role guard — employee cannot access admin routes', () => {
  test.use({ storageState: AUTH_FILES.employee4d })

  test('employee visiting /admin/dashboard is redirected to /calendar', async ({ page }) => {
    await page.goto('/admin/dashboard')
    // Admin layout redirects non-admins to /, then page.tsx routes employee to /calendar
    await expect(page).toHaveURL('/calendar', { timeout: 10_000 })
  })
})
