import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeCompany } from '@/lib/crm-normalize'
import { sanitizeCompanyField } from './validate'

/* ────────────────────────────────────────────────────────────────────────────
   Companies collection (migration 062).

   GET  → { companies, contacts } — the full CRM graph in one response; the
          Companies tab refreshes from here after backfill/merge operations.
   POST → create a company. Find-or-create by normalized_name: creating
          "Trane CO" when "Trane" exists returns the existing row
          ({ existed: true }) instead of erroring — the New Deal combobox and
          the review panel both lean on this being idempotent.
   ──────────────────────────────────────────────────────────────────────────── */

const CREATE_FIELDS = ['kind', 'customer_id', 'domain', 'website', 'phone', 'location', 'notes'] as const

export async function GET() {
  const err = await requireCrmAuth(); if (err) return err
  const [{ data: companies, error: cErr }, { data: contacts, error: kErr }] = await Promise.all([
    supabaseAdmin.from('companies').select('*').order('name'),
    supabaseAdmin.from('contacts').select('*').order('name'),
  ])
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (kErr) return NextResponse.json({ error: kErr.message }, { status: 500 })
  return NextResponse.json({ companies: companies ?? [], contacts: contacts ?? [] })
}

export async function POST(req: NextRequest) {
  const err = await requireCrmAuth(); if (err) return err
  const body = await req.json().catch(() => ({}))

  const nameCheck = sanitizeCompanyField('name', body.name)
  if (nameCheck.error) return NextResponse.json({ error: nameCheck.error }, { status: 400 })
  const name = nameCheck.value as string
  const { normalized } = normalizeCompany(name)

  const { data: existing } = await supabaseAdmin
    .from('companies').select('*').eq('normalized_name', normalized).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, company: existing, existed: true })

  const insert: Record<string, unknown> = { name, normalized_name: normalized }
  for (const f of CREATE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeCompanyField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    insert[f] = check.value
  }

  const { data, error } = await supabaseAdmin.from('companies').insert(insert).select('*').single()
  if (error) {
    // Unique race on normalized_name — someone created it between our check
    // and the insert; hand back theirs.
    if (/duplicate key|companies_normalized_idx/i.test(error.message)) {
      const { data: raced } = await supabaseAdmin
        .from('companies').select('*').eq('normalized_name', normalized).maybeSingle()
      if (raced) return NextResponse.json({ ok: true, company: raced, existed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, company: data, existed: false })
}
