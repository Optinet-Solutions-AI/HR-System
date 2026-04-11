import { defineConfig } from '@playwright/test'
import { config } from 'dotenv'
import path from 'path'

// Load local E2E env (overrides .env.local so tests always run against local Supabase)
// .env.e2e.local is git-ignored; create it from supabase status output
config({ path: path.join(__dirname, '../.env.e2e.local'), override: true })
// Fall back to .env.local for any vars not in .env.e2e.local
config({ path: path.join(__dirname, '../.env.local') })

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'e2e',
      testMatch: /\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
