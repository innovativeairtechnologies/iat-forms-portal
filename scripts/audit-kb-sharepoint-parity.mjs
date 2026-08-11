/**
 * Prove — or disprove — that Jerry and the SharePoint library hold the same set
 * of documents.
 *
 * Written to be run by whoever owns this next, not just today. "It should be
 * 1:1" is a belief; this prints the evidence, names every file on either side
 * that the other doesn't have, and exits non-zero when they disagree, so it can
 * be wired into a check later if that's ever wanted.
 *
 * Reads the SharePoint side from the live Graph API (the same read the pull
 * uses), so it reflects the library as it actually is rather than a local
 * mirror, which can lag or flatten folders.
 *
 *   node scripts/audit-kb-sharepoint-parity.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const GRAPH = 'https://graph.microsoft.com/v1.0'
// Kept in step with lib/kb-sharepoint-sync. Spreadsheets and presentations are
// intentionally absent: their text is formulas and fragments, not knowledge.
const READABLE = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
])

async function graphToken() {
  const res = await fetch(`https://login.microsoftonline.com/${process.env.MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MS_GRAPH_CLIENT_ID,
      client_secret: process.env.MS_GRAPH_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
    }),
  })
  const j = await res.json()
  if (!j.access_token) throw new Error(`Graph auth failed: ${j.error_description || res.status}`)
  return j.access_token
}

async function listLibrary(token, driveId) {
  const out = []
  let url = `${GRAPH}/drives/${driveId}/root/delta?$select=id,name,file,folder,deleted,size,webUrl`
  for (let guard = 0; guard < 500; guard++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const page = await res.json()
    if (!res.ok) throw new Error(page?.error?.message || `Graph list failed (${res.status})`)
    for (const it of page.value || []) {
      if (it.file && !it.folder && !it.deleted) out.push(it)
    }
    if (page['@odata.nextLink']) { url = page['@odata.nextLink']; continue }
    break
  }
  return out
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const token = await graphToken()
  const driveId = process.env.SHAREPOINT_DRIVE_ID
  if (!driveId) throw new Error('SHAREPOINT_DRIVE_ID is not set')

  const files = await listLibrary(token, driveId)
  const readable = files.filter((f) => READABLE.has(f.file?.mimeType || ''))
  const unreadable = files.filter((f) => !READABLE.has(f.file?.mimeType || ''))

  const { data: docs } = await supabase
    .from('kb_documents').select('id, title, source_filename, sharepoint_item_id, pushed_at')
  const { data: queue } = await supabase
    .from('kb_review_queue').select('external_id, filename, status')

  const inJerry = new Set((docs || []).filter((d) => d.sharepoint_item_id).map((d) => d.sharepoint_item_id))
  const queueByItem = new Map((queue || []).map((q) => [q.external_id, q.status]))

  // A file is "covered" if Jerry holds it, or a human has consciously decided
  // about it. Awaiting review is NOT covered — it is outstanding work.
  const missing = [], pending = [], rejected = []
  for (const f of readable) {
    if (inJerry.has(f.id)) continue
    const st = queueByItem.get(f.id)
    if (st === 'pending') pending.push(f)
    else if (st === 'rejected') rejected.push(f)
    else missing.push(f)
  }

  // The other direction: something in Jerry claiming a SharePoint item that is
  // no longer in the library (deleted or moved upstream).
  const liveIds = new Set(files.map((f) => f.id))
  const orphaned = (docs || []).filter((d) => d.sharepoint_item_id && !liveIds.has(d.sharepoint_item_id))

  const pushed = (docs || []).filter((d) => d.pushed_at).length
  const portalOnly = (docs || []).filter((d) => !d.sharepoint_item_id).length

  console.log('════ Jerry ⇄ SharePoint parity ════\n')
  console.log(`SharePoint library : ${files.length} files (${readable.length} readable, ${unreadable.length} not)`)
  console.log(`Jerry              : ${(docs || []).length} documents (${inJerry.size} linked to SharePoint, ${portalOnly} portal-only, ${pushed} pushed up)\n`)
  console.log(`✅ readable files Jerry holds     : ${readable.length - missing.length - pending.length - rejected.length}`)
  console.log(`⏳ awaiting review                : ${pending.length}`)
  console.log(`🚫 rejected by a person           : ${rejected.length}`)
  console.log(`❌ NOT in Jerry and NOT in queue  : ${missing.length}`)
  console.log(`⚠️  in Jerry but gone from SharePoint: ${orphaned.length}`)

  if (missing.length) {
    console.log('\n--- not accounted for anywhere (run a pull) ---')
    for (const f of missing.slice(0, 25)) console.log(`   ${f.name}`)
    if (missing.length > 25) console.log(`   …and ${missing.length - 25} more`)
  }
  if (pending.length) {
    console.log('\n--- awaiting your review ---')
    for (const f of pending.slice(0, 25)) console.log(`   ${f.name}`)
  }
  if (orphaned.length) {
    console.log('\n--- in Jerry, missing upstream ---')
    for (const d of orphaned.slice(0, 15)) console.log(`   ${d.title}`)
  }
  if (unreadable.length) {
    console.log('\n--- in SharePoint, deliberately not read (spreadsheets/presentations/email) ---')
    for (const f of unreadable.slice(0, 15)) console.log(`   ${f.name}`)
    if (unreadable.length > 15) console.log(`   …and ${unreadable.length - 15} more`)
  }

  const parity = missing.length === 0 && pending.length === 0 && orphaned.length === 0
  console.log(`\n${parity ? '✅ PARITY: every readable file in SharePoint is in Jerry or consciously rejected.'
                          : '⚠️  NOT YET 1:1 — see the lists above.'}`)
  process.exit(parity ? 0 : 1)
}

main().catch((e) => { console.error(e.message || e); process.exit(2) })
