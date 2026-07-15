import { test, expect } from '@playwright/test'

/**
 * IAT Portal smoke tests — the deploy safety net.
 *
 * IMPORTANT: the dev server (and any non-staging deploy) talks to the
 * PRODUCTION Supabase project — there is no separate test database yet — so
 * every test here is strictly READ-ONLY / NON-MUTATING. No form or ticket is
 * ever submitted. Add write-path tests only against a dedicated staging DB.
 * (Tracked in docs/08-security.md §9.)
 *
 * Assertions favour HTTP status + URL + a couple of highly-stable elements
 * over brittle text/role selectors, so the suite stays a reliable signal of
 * "the app boots and its auth boundaries hold" rather than a flaky guess.
 */

test.describe('public entry points load', () => {
  for (const path of ['/login', '/support', '/support/status']) {
    test(`${path} responds without a server error`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res, `no response for ${path}`).toBeTruthy()
      expect(res!.status(), `${path} status`).toBeLessThan(400)
    })
  }

  test('/login shows the credentials form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})

test.describe('auth boundary redirects anonymous users to /login', () => {
  for (const path of ['/admin', '/employee/profile', '/learn']) {
    test(`${path} -> /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  // Regression test for the static-tool gating added in the cleanup/hardening
  // sprint (security item 8.3): public/tools/*.html must require a login.
  test('/tools/*.html -> /login (internal tools are staff-only)', async ({ page }) => {
    await page.goto('/tools/voltage-scaling-calculator.html')
    await expect(page).toHaveURL(/\/login/)
  })
})

/**
 * Optional authenticated smoke. Runs only when test credentials are provided
 * via env (TEST_EMPLOYEE_EMAIL / TEST_EMPLOYEE_PASSWORD), so the suite never
 * hardcodes secrets and stays green without them.
 */
const EMP_EMAIL = process.env.TEST_EMPLOYEE_EMAIL
const EMP_PW = process.env.TEST_EMPLOYEE_PASSWORD

test.describe('authenticated employee (optional)', () => {
  test.skip(!EMP_EMAIL || !EMP_PW, 'set TEST_EMPLOYEE_EMAIL / TEST_EMPLOYEE_PASSWORD to enable')

  test('logs in and lands inside the portal', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"], input[type="text"]').first().fill(EMP_EMAIL!)
    await page.locator('input[type="password"]').fill(EMP_PW!)
    await page
      .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")')
      .first()
      .click()
    await expect(page).toHaveURL(/\/(employee|admin|learn)/, { timeout: 20_000 })
  })
})
