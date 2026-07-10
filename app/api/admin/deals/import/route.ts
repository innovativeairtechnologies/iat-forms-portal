import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { parseSalesForecastXlsx, type ImportResult } from '@/lib/deals-import'

export const runtime = 'nodejs'

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/admin/deals/import — upload a monday.com Sales Forecasting export.

   multipart/form-data fields:
     file    the .xlsx export (required)
     mode    'replace' (default) — the export IS the whole board, so wipe and
             reload; 'append' — add rows on top of what's already here
     commit  'true' to write; anything else = dry run (parse + preview only)

   Two-phase on purpose: the modal first dry-runs to show the user exactly
   what will happen (per-group counts, totals, warnings, and what replace
   would delete), then commits. Gated by requireDealsAuth — same trust
   boundary as the rest of the deals API (sales reps own their board and will
   re-upload fresh exports until the monday.com integration exists).
   ──────────────────────────────────────────────────────────────────────────── */

// The export is a whole-board snapshot, typically well under 1MB. 8MB leaves
// generous headroom while refusing absurd uploads before XLSX.read sees them.
const MAX_BYTES = 8 * 1024 * 1024

const CHUNK = 200 // rows per insert statement

type Preview = {
  groups: ImportResult['groups']
  totalDeals: number
  totalCost: number
  totalWeighted: number
  warnings: string[]
  existingCount: number
  mode: 'replace' | 'append'
}

export async function POST(req: NextRequest) {
  const err = await requireDealsAuth(); if (err) return err

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach the exported .xlsx as "file".' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That file is larger than 8MB — not a board export.' }, { status: 413 })
  }
  const mode = form.get('mode') === 'append' ? 'append' : 'replace'
  const commit = form.get('commit') === 'true'

  let parsed: ImportResult
  try {
    parsed = parseSalesForecastXlsx(await file.arrayBuffer())
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not parse that file.' }, { status: 400 })
  }

  const { count: existingCount, error: countErr } = await supabaseAdmin
    .from('deals')
    .select('*', { count: 'exact', head: true })
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })

  const preview: Preview = {
    groups: parsed.groups,
    totalDeals: parsed.deals.length,
    totalCost: parsed.deals.reduce((a, d) => a + d.total_cost, 0),
    totalWeighted: parsed.deals.reduce((a, d) => a + d.total_cost * (d.confidence / 100), 0),
    warnings: parsed.warnings,
    existingCount: existingCount ?? 0,
    mode,
  }

  if (!commit) return NextResponse.json({ ok: true, dryRun: true, preview })

  // ── Commit ──────────────────────────────────────────────────────────────
  if (mode === 'replace') {
    // Full-table wipe scoped by a tautological filter (PostgREST refuses a
    // bare unfiltered DELETE).
    const { error: delErr } = await supabaseAdmin.from('deals').delete().gte('created_at', '1970-01-01')
    if (delErr) return NextResponse.json({ error: `Could not clear existing deals: ${delErr.message}` }, { status: 500 })
  }

  let inserted = 0
  for (let i = 0; i < parsed.deals.length; i += CHUNK) {
    const chunk = parsed.deals.slice(i, i + CHUNK)
    const { error: insErr } = await supabaseAdmin.from('deals').insert(chunk)
    if (insErr) {
      return NextResponse.json(
        {
          error:
            `Import stopped after ${inserted} of ${parsed.deals.length} rows: ${insErr.message}` +
            (mode === 'replace' ? ' The board was partially replaced — re-upload to recover.' : ''),
        },
        { status: 500 },
      )
    }
    inserted += chunk.length
  }

  const surfaceUser = await getAdminSurfaceUser()
  await logAudit({
    actor: { id: surfaceUser?.user.id, name: surfaceUser?.displayName },
    action: 'deal.import',
    entityType: 'deal',
    summary:
      `Imported ${inserted} deals from "${file.name}" (${mode}` +
      (mode === 'replace' ? `, replaced ${existingCount ?? 0} existing` : '') +
      `) — ${parsed.groups.map((g) => `${g.name} ${g.count}`).join(', ')}`,
    metadata: {
      file: file.name,
      mode,
      inserted,
      replaced: mode === 'replace' ? existingCount ?? 0 : 0,
      groups: parsed.groups,
      warnings: parsed.warnings.length,
    },
  })

  // Hand back the fresh board so the client can swap state without refetching.
  const { data: deals, error: selErr } = await supabaseAdmin
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (selErr) return NextResponse.json({ ok: true, inserted, preview, deals: null })

  return NextResponse.json({ ok: true, inserted, preview, deals })
}
