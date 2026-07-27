/**
 * Backfill existing customers onto the CUSTOMER PORTAL deployment.
 *
 * The customer portal (iat-customer) has its own Supabase project, so customers
 * invited before the split don't exist there. This walks the internal customers
 * table and provisions each one through the same /api/provision endpoint the
 * invite flow now calls — so there is exactly one code path that creates
 * customer logins, and this script is just a bulk driver for it.
 *
 * Each account is created with a FRESH random temp password, which is NOT
 * emailed. Nobody can sign in with it, and that's deliberate: the point of the
 * backfill is to get the accounts and company mirrors in place so the bridge can
 * be exercised end-to-end, without spraying credentials at customers weeks
 * before cutover. At cutover, either re-run the invite flow (which does email)
 * or have customers use password reset.
 *
 * Run:
 *   node scripts/backfill-customer-portal.mjs --dry-run    # list what would happen
 *   node scripts/backfill-customer-portal.mjs              # provision active customers
 *   node scripts/backfill-customer-portal.mjs --all        # include inactive ones too
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CUSTOMER_PORTAL_URL and INTERNAL_BRIDGE_SECRET.
 */
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const DRY_RUN = process.argv.includes('--dry-run')
const INCLUDE_INACTIVE = process.argv.includes('--all')

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CUSTOMER_PORTAL_URL, INTERNAL_BRIDGE_SECRET } = env

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ...(DRY_RUN ? {} : { CUSTOMER_PORTAL_URL, INTERNAL_BRIDGE_SECRET }),
})) {
  if (!value) {
    console.error(`✗ Missing ${name} in .env.local`)
    process.exit(1)
  }
}

const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/** Mirrors lib/temp-password.ts: long, random, and replaced at first sign-in. */
function tempPassword() {
  return randomBytes(18).toString('base64url')
}

async function provision(input) {
  const path = '/api/provision'
  const timestamp = Date.now().toString()
  const payload = JSON.stringify(input)
  const signature = createHmac('sha256', INTERNAL_BRIDGE_SECRET)
    .update(`${timestamp}.POST.${path}.${payload}`)
    .digest('hex')

  const res = await fetch(`${CUSTOMER_PORTAL_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-iat-timestamp': timestamp,
      'x-iat-signature': signature,
    },
    body: payload,
    // Never follow redirects — a bounced /api/provision would return the login
    // page with HTTP 200 and this script would report every customer as
    // provisioned while nothing happened.
    redirect: 'manual',
  })
  if (res.status >= 300 && res.status < 400) {
    return { ok: false, status: res.status, data: { error: 'unexpected redirect — check CUSTOMER_PORTAL_URL' } }
  }
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  let query = sb.from('customers').select('id, company_name, contact_email, primary_contact_name, status')
  if (!INCLUDE_INACTIVE) query = query.eq('status', 'active')
  const { data: customers, error } = await query.order('company_name')

  if (error) {
    console.error('✗ Could not read customers:', error.message)
    process.exit(1)
  }
  if (!customers?.length) {
    console.log('No customers to backfill.')
    return
  }

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}${customers.length} customer(s)` +
      `${INCLUDE_INACTIVE ? ' (including inactive)' : ' (active only)'}\n`
  )

  let done = 0
  let skipped = 0
  let failed = 0

  for (const c of customers) {
    const label = `${c.company_name} <${c.contact_email || 'no email'}>`

    // A customer with no contact email has no login to provision — the email IS
    // the account identifier.
    if (!c.contact_email) {
      console.log(`  ‒ skip  ${label} — no contact email`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`  · would provision  ${label}`)
      done++
      continue
    }

    const result = await provision({
      op: 'create',
      customerId: c.id,
      email: c.contact_email,
      companyName: c.company_name,
      displayName: c.primary_contact_name || null,
      tempPassword: tempPassword(),
    })

    if (result.ok) {
      console.log(`  ✓ ${label}`)
      done++
    } else {
      console.log(`  ✗ ${label} — ${result.data?.error || `HTTP ${result.status}`}`)
      failed++
    }
  }

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] ' : ''}${done} provisioned, ${skipped} skipped, ${failed} failed.`
  )
  if (!DRY_RUN && done) {
    console.log(
      'Note: temp passwords were NOT emailed. Customers reach the new portal via\n' +
        'password reset, or by re-running the invite flow at cutover.'
    )
  }
  if (failed) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
