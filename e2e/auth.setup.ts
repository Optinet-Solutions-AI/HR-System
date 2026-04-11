import { test as setup } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'
import { AUTH_FILES } from './fixtures/auth-files'
import { TEST_USERS } from './fixtures/test-users'

// Ensure .auth directory exists before any setup test writes to it
mkdirSync(path.dirname(AUTH_FILES.employee4d), { recursive: true })

setup('authenticate as employee4d', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_USERS.employee4d.email)
  await page.getByLabel('Password').fill(TEST_USERS.employee4d.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // page.tsx redirects employee role to /calendar
  await page.waitForURL('/calendar', { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILES.employee4d })
})

setup('authenticate as employee5d', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_USERS.employee5d.email)
  await page.getByLabel('Password').fill(TEST_USERS.employee5d.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/calendar', { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILES.employee5d })
})

setup('authenticate as hradmin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(TEST_USERS.hradmin.email)
  await page.getByLabel('Password').fill(TEST_USERS.hradmin.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // page.tsx redirects hr_admin role to /admin/dashboard
  await page.waitForURL('/admin/dashboard', { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILES.hradmin })
})
