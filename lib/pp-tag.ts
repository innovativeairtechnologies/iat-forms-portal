import 'server-only'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import type { PpTag } from './post-production'

/* ────────────────────────────────────────────────────────────────────────────
   lib/pp-tag.ts — resolving a shop-floor QR token into a capability.

   🔴 EVERY /api/walk/* ROUTE STARTS HERE, AND NONE OF THEM MAY TAKE AN ID FROM
   THE BODY WITHOUT CHECKING IT AGAINST WHAT THIS RETURNS.

   The token is the entire credential. Without the ownership checks below it
   would be a UNIVERSAL write key: anyone holding the sticker from the test bay
   could PATCH a finding on somebody else's walkaround by posting a different
   uuid. That is the exact hole app/api/board/[token]/check/route.ts calls out
   and closes, and this is the same shape of page.

   The rules, in order, every time:
     1. Resolve the tag from the URL token, server-side, with .eq() — never
        .ilike(), which would match loosely AND throw away the token's entropy.
     2. Return the SAME 404 for an unknown token and a deactivated tag. Never
        confirm which tokens are real.
     3. Load the walkaround/finding and verify it belongs to THIS tag and is
        still open before any write.
     4. Re-read everything else from the database. The only client values that
        survive are the ones explicitly whitelisted at the call site.
   ──────────────────────────────────────────────────────────────────────────── */

/** Token shape, matching the CHECK constraint in migration 099. Rejecting a
 *  malformed token before it reaches the database keeps junk out of the query
 *  path and makes the 404 identical for "wrong shape" and "no such tag". */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

const notFound = () =>
  NextResponse.json({ error: 'This tag is no longer active.' }, { status: 404 })

/** Resolve a token to its tag, or a ready-to-return 404. */
export async function resolveTag(token: string): Promise<PpTag | NextResponse> {
  if (!TOKEN_RE.test(token)) return notFound()

  const { data, error } = await supabaseAdmin
    .from('pp_tags')
    .select('id, token, label, job_number, is_active, notes, created_at, updated_at')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    console.error('[pp-tag] resolve failed:', error.message)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
  // Same answer for "no such tag" and "retired tag" — see rule 2.
  if (!data || !data.is_active) return notFound()
  return data as PpTag
}

/**
 * The walkaround a scanner is allowed to write to: it must belong to THIS tag
 * and still be open.
 *
 * ⚠️ `.eq('tag_id', tag.id)` is the load-bearing clause. Dropping it turns every
 * sticker in the building into a write key for every in-progress walk.
 *
 * ⚠️ `.eq('status', 'walking')` is the second one. A submitted walkaround is in
 * engineering's queue with dates on it and people being chased against it; the
 * sticker must not be able to reach back in and edit what it said.
 */
export async function walkForTag(
  tagId: string,
  walkaroundId: string,
): Promise<{ id: string; job_number: string; job_id: string | null } | NextResponse> {
  if (!walkaroundId) return notFound()

  const { data } = await supabaseAdmin
    .from('pp_walkarounds')
    .select('id, job_number, job_id')
    .eq('id', walkaroundId)
    .eq('tag_id', tagId)
    .eq('status', 'walking')
    .maybeSingle()

  if (!data) {
    return NextResponse.json(
      { error: 'That walkaround has already been handed over, or belongs to a different tag.' },
      { status: 404 },
    )
  }
  return data as { id: string; job_number: string; job_id: string | null }
}

/** A finding a scanner may edit: it must hang off a walkaround belonging to this
 *  tag, and still be a draft. */
export async function findingForTag(
  tagId: string,
  findingId: string,
): Promise<{ id: string; walkaround_id: string; media: unknown } | NextResponse> {
  if (!findingId) return notFound()

  const { data } = await supabaseAdmin
    .from('pp_findings')
    .select('id, walkaround_id, media, walk:pp_walkarounds!inner(tag_id, status)')
    .eq('id', findingId)
    .eq('status', 'draft')
    .maybeSingle()

  const walk = data
    ? (Array.isArray(data.walk) ? data.walk[0] : data.walk) as { tag_id: string | null; status: string } | null
    : null

  if (!data || !walk || walk.tag_id !== tagId || walk.status !== 'walking') {
    return NextResponse.json({ error: 'That note is no longer editable.' }, { status: 404 })
  }
  return data as { id: string; walkaround_id: string; media: unknown }
}

/* ── Caps ────────────────────────────────────────────────────────────────────
   Rate limiting is the first line and it FAILS OPEN by design (lib/rate-limit).
   These are the second: hard ceilings that hold even when the limiter is down,
   so the worst a leaked sticker can do is bounded rather than unbounded.

   Both are far above any real walk — the biggest post-production review anybody
   described was a dozen observations — and both produce a sentence a person can
   read rather than a silent truncation. */
export const MAX_FINDINGS_PER_WALK = 40
export const MAX_MEDIA_PER_FINDING = 12
