import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke-test config for the IAT Portal.
 *
 * By default this starts the local dev server (`npm run dev`) and tests against
 * it. Set E2E_BASE_URL to point at an already-running URL instead (e.g. a Vercel
 * preview deployment) — no local server is started in that case.
 *
 * NOTE: the dev server talks to the PRODUCTION Supabase project (there is no
 * separate test database yet), so all specs are strictly read-only /
 * non-mutating. See e2e/smoke.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
