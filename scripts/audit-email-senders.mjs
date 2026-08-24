#!/usr/bin/env node
/* Fails if any email send is not explicitly classified by audience.
 *
 * Why this exists: on 2026-08-20 staff-bound mail was moved onto a subdomain,
 * because mail claiming to be from dehumidifiers.com but arriving from outside
 * is treated as spoofing by our own filtering and quarantines. The sweep that
 * day covered every sender an ACTION triggers and missed every sender a
 * SCHEDULE triggers, so ticket alerts worked while the reminders — the safety
 * net for a ticket nobody picked up — silently quarantined for four days.
 *
 * The failure was that "which audience is this for" lived in someone's head.
 * Now it lives at the call site: every send must either use internalFrom(), or
 * carry a `// customer-facing` marker within the three lines above it.
 *
 * Run: npm run audit:email
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['lib', 'app']
const SEND = /resend\.(emails|batch)\.send/
const MARKER = /customer-facing/

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue
      walk(full, out)
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

const problems = []
const staff = []
const customer = []

for (const file of ROOTS.flatMap(r => (fs.existsSync(r) ? walk(r) : []))) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)

  // Module-level `const FROM = ...` so a bare `from: FROM` can be resolved.
  const fromConst = lines.find(l => /^const FROM\s*=/.test(l)) ?? ''

  // A module whose every send goes to customers can say so once, near the top,
  // instead of repeating the marker on each call.
  const fileWide = lines.slice(0, 40).some(l => /audit: all sends customer-facing/.test(l))

  lines.forEach((line, i) => {
    if (!SEND.test(line)) return
    // Skip prose — several files discuss resend.emails.send() in comments.
    const t = line.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return

    // The `from:` for this call is on the same line or shortly after.
    let fromExpr = null
    for (let j = i; j < Math.min(i + 8, lines.length); j++) {
      const m = lines[j].match(/from:\s*([^,}]+)/)
      if (m) { fromExpr = m[1].trim(); break }
    }

    const resolved = fromExpr === 'FROM' ? fromConst : (fromExpr ?? '')
    const isStaff = /internalFrom/.test(resolved)
    const marked = fileWide || lines
      .slice(Math.max(0, i - 3), i + 2)
      .some(l => MARKER.test(l))

    const at = `${file.replace(/\\/g, '/')}:${i + 1}`
    if (isStaff) staff.push(at)
    else if (marked) customer.push(at)
    else problems.push({ at, fromExpr: fromExpr ?? '(none found)' })
  })
}

console.log(`staff senders (internalFrom):     ${staff.length}`)
console.log(`customer senders (marked):        ${customer.length}`)

if (problems.length) {
  console.error(`\nUNCLASSIFIED SENDS: ${problems.length}\n`)
  for (const p of problems) {
    console.error(`  ${p.at}`)
    console.error(`      from: ${p.fromExpr}`)
  }
  console.error(`
Every send must declare its audience.

  Mail to IAT staff        -> from: internalFrom(EMAIL_FROM.PORTAL)   (or SUPPORT / FORMS)
  Mail to customers        -> keep EMAIL_FROM.*, and add a comment containing
                              "customer-facing" within the 3 lines above the send

Staff mail on dehumidifiers.com quarantines. Do not guess -- ask who receives it.
See docs/support-tickets.md.`)
  process.exit(1)
}

console.log('\nAll sends classified.')
