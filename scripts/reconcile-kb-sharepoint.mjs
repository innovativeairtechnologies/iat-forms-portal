/**
 * Reconcile Jerry's existing documents with the SharePoint pull queue.
 *
 * WHY THIS EXISTS
 * Jerry's first 68 documents were loaded by the CLI before SharePoint linking
 * existed, so they carry no sharepoint_item_id. The pull's dedup asks Jerry
 * "which SharePoint items do you already have?" and those rows answer nothing —
 * so every file in the library looks brand new. Approving the queue as it stands
 * would give Jerry a second copy of 127 documents it already knows, and it would
 * cite the same manual twice.
 *
 * The queue itself holds the missing link: each pending row carries both the
 * filename and the SharePoint item id. So the fix is to match on filename and
 * stamp the id onto the document that already exists — no re-reading, no AI
 * spend, and the chunks Jerry already has (184 of them for the ASPYRE manual)
 * stay exactly as they are.
 *
 * THE SECOND DUPLICATION, which is not a bug
 * The library keeps the same file in both Internal Documents and External
 * Documents — two real SharePoint items, same content. Jerry wants one copy.
 * A file present in External Documents is cleared for customers, so the surviving
 * copy is marked customer-facing; the Internal twin is closed as a duplicate.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   node scripts/reconcile-kb-sharepoint.mjs           # report only
 *   node scripts/reconcile-kb-sharepoint.mjs --apply   # make the changes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')

// .env.local, same as the other scripts here
const envPath = resolve(__dirname, '..', '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const isExternal = (webUrl) => !!webUrl && /\/External(%20| )?Documents\//i.test(webUrl)

async function main() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (pass --apply to write) ===\n')

  const { data: pending, error: qErr } = await supabase
    .from('kb_review_queue')
    .select('id, filename, external_id, external_ctag, web_url')
    .eq('status', 'pending')
  if (qErr) throw new Error(`queue read failed: ${qErr.message}`)

  const { data: docs, error: dErr } = await supabase
    .from('kb_documents')
    .select('id, source_filename, is_internal, sharepoint_item_id')
  if (dErr) throw new Error(`documents read failed: ${dErr.message}`)

  // Only rows with no SharePoint identity are candidates for linking; anything
  // already linked is correct and must not be touched.
  const legacy = new Map()
  for (const d of docs) {
    if (d.sharepoint_item_id) continue
    legacy.set((d.source_filename || '').toLowerCase(), d)
  }

  // One group per filename: the Internal and External copies of the same file.
  const groups = new Map()
  for (const row of pending) {
    const key = (row.filename || '').toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const plan = { link: [], duplicate: [], leavePending: [] }

  for (const [key, rows] of groups) {
    // Prefer the External copy: its presence there is the signal that the
    // document is cleared for customers.
    const external = rows.find((r) => isExternal(r.web_url))
    const keep = external || rows[0]
    const drop = rows.filter((r) => r.id !== keep.id)
    for (const d of drop) plan.duplicate.push({ ...d, becauseOf: keep.filename })

    const match = legacy.get(key)
    if (match) {
      plan.link.push({
        docId: match.id,
        filename: keep.filename,
        itemId: keep.external_id,
        ctag: keep.external_ctag,
        // In External Documents → customer-facing. Otherwise leave staff-only.
        isInternal: !external,
        wasInternal: match.is_internal,
        queueId: keep.id,
      })
      legacy.delete(key) // one document per filename; don't match it twice
    } else {
      plan.leavePending.push(keep.filename)
    }
  }

  console.log(`Pending queue rows      : ${pending.length}`)
  console.log(`Unique filenames        : ${groups.size}`)
  console.log(`→ link to existing doc  : ${plan.link.length}   (no re-read, chunks kept)`)
  console.log(`→ close as duplicate    : ${plan.duplicate.length}   (same file in the other folder)`)
  console.log(`→ leave pending, genuinely new: ${plan.leavePending.length}`)
  const flips = plan.link.filter((l) => l.wasInternal && !l.isInternal).length
  console.log(`   of the linked, becoming customer-facing: ${flips}`)
  console.log('')
  console.log('Sample links:')
  for (const l of plan.link.slice(0, 5)) {
    console.log(`   ${l.filename} → ${l.itemId.slice(0, 22)}…  internal:${l.wasInternal}→${l.isInternal}`)
  }
  console.log('')
  console.log('Sample new documents left for review:')
  for (const f of plan.leavePending.slice(0, 5)) console.log(`   ${f}`)

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply to make these changes.')
    return
  }

  let linked = 0, closed = 0, failed = 0
  for (const l of plan.link) {
    const { error: uErr } = await supabase
      .from('kb_documents')
      .update({
        sharepoint_item_id: l.itemId,
        sharepoint_ctag: l.ctag,
        is_internal: l.isInternal,
        source: 'sharepoint',
      })
      .eq('id', l.docId)
    if (uErr) { failed++; console.error(`   FAILED ${l.filename}: ${uErr.message}`); continue }

    // The document is represented in Jerry, so this queue row is resolved.
    await supabase.from('kb_review_queue')
      .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: 'reconcile-script' })
      .eq('id', l.queueId)
    linked++
  }

  for (const d of plan.duplicate) {
    const { error } = await supabase.from('kb_review_queue')
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: `duplicate of ${d.becauseOf}` })
      .eq('id', d.id)
    if (error) failed++; else closed++
  }

  console.log(`\nLinked ${linked}, closed ${closed} duplicates, ${failed} failed.`)
  console.log(`${plan.leavePending.length} genuinely new documents remain for review.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
