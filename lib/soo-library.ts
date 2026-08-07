import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'
import { validateLibrary, type SooLibrary } from './soo'
import { SOO_MASTER_LIBRARY } from './soo-master'

// ─────────────────────────────────────────────────────────────────────────────
// lib/soo-library.ts — the DB-backed master SOO clause library (migration 084).
//
// Follows lib/srv-config.ts: single row, whole-blob JSON, FALL BACK to the code
// default whenever no row is saved / the row is malformed / the read errors, so
// a document can always be assembled. Server-only (service-role); lib/soo.ts and
// lib/soo-master.ts stay pure + client-safe.
//
// ── The one thing this adds over srv-config ─────────────────────────────────
// VERSIONS. SRV content is a checklist someone fills in; this content is a
// controls contract. If an engineer edits a master clause, every document
// regenerated afterwards changes — including one that was already approved and
// sent — with nothing recording that it moved.
//
// So: every save appends the whole library to soo_library_versions under a new
// integer version, and approving a document pins the version it was built from.
// `getLibraryVersion(n)` then replays exactly what an approved document said.
// Same reasoning as 079_proposals.sql freezing sizing_result alongside its
// inputs — the engine will change, and the document has to stay true.
// ─────────────────────────────────────────────────────────────────────────────

const SOO_LIBRARY_ID = 1

/**
 * The live master library. Falls back to code on ANY problem — a document must
 * always be assemblable, and a half-read library would be worse than the known
 * default. Validation runs on the way out, not just on save: a row written by an
 * older schema, or by hand, must not reach the assembler.
 */
export const getSooLibrary = cache(async (): Promise<SooLibrary> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('soo_library')
      .select('library')
      .eq('id', SOO_LIBRARY_ID)
      .maybeSingle()
    if (error || !data?.library) return SOO_MASTER_LIBRARY
    const library = data.library as SooLibrary
    if (validateLibrary(library) !== null) {
      console.error('[soo-library] stored library failed validation — using the code default')
      return SOO_MASTER_LIBRARY
    }
    return library
  } catch {
    return SOO_MASTER_LIBRARY
  }
})

/**
 * A specific historical version, for re-rendering an approved document exactly
 * as it was signed. Returns null when the version is unknown — the caller shows
 * "this document was built from a library version that is no longer on file"
 * rather than silently rendering it from today's content, which would be a
 * quiet rewrite of an approved controls narrative.
 */
export async function getLibraryVersion(version: number): Promise<SooLibrary | null> {
  const { data, error } = await supabaseAdmin
    .from('soo_library_versions')
    .select('library')
    .eq('version', version)
    .maybeSingle()
  if (error || !data?.library) return null
  const library = data.library as SooLibrary
  return validateLibrary(library) === null ? library : null
}

/**
 * Persist a new library. Validates, assigns the next version, appends to the
 * history, then points the live row at it.
 *
 * The append happens BEFORE the live row moves. If the second write fails the
 * history carries an unreferenced version, which is harmless; the reverse order
 * could leave a live library with no historical record, which is not.
 */
export async function saveSooLibrary(
  incoming: SooLibrary,
  updatedBy: string | null,
  note?: string
): Promise<{ version: number }> {
  const err = validateLibrary(incoming)
  if (err) throw new Error(err)

  const { data: latest } = await supabaseAdmin
    .from('soo_library_versions')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const current = await getSooLibrary()
  const version = Math.max(latest?.version ?? 0, current.version) + 1
  const library: SooLibrary = { ...incoming, version }

  const { error: histErr } = await supabaseAdmin
    .from('soo_library_versions')
    .insert({ version, library, note: note ?? null, created_by: updatedBy })
  if (histErr) throw new Error(histErr.message)

  const { error: liveErr } = await supabaseAdmin
    .from('soo_library')
    .upsert({ id: SOO_LIBRARY_ID, library, updated_by: updatedBy, updated_at: new Date().toISOString() })
  if (liveErr) throw new Error(liveErr.message)

  return { version }
}

/**
 * Seed the history from the code default so version 1 is on file before any
 * document is approved against it. Idempotent.
 */
export async function ensureLibrarySeeded(): Promise<void> {
  const { data } = await supabaseAdmin
    .from('soo_library_versions')
    .select('version')
    .eq('version', SOO_MASTER_LIBRARY.version)
    .maybeSingle()
  if (data) return
  await supabaseAdmin
    .from('soo_library_versions')
    .insert({ version: SOO_MASTER_LIBRARY.version, library: SOO_MASTER_LIBRARY, note: 'Seeded from lib/soo-master.ts' })
}
