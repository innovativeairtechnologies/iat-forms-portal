import { NextRequest, NextResponse } from 'next/server'
import { requireCrmAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeContactField } from '../companies/validate'

const CREATE_FIELDS = ['title', 'email', 'phone', 'is_primary', 'notes'] as const

// Create a contact (migration 062). company_id is verified so a stale id is a
// clean 400, not a raw FK-violation 500.
export async function POST(req: NextRequest) {
  const err = await requireCrmAuth(); if (err) return err
  const body = await req.json().catch(() => ({}))

  const companyCheck = sanitizeContactField('company_id', body.company_id)
  if (companyCheck.error) return NextResponse.json({ error: companyCheck.error }, { status: 400 })
  const nameCheck = sanitizeContactField('name', body.name)
  if (nameCheck.error) return NextResponse.json({ error: nameCheck.error }, { status: 400 })

  const { data: company } = await supabaseAdmin
    .from('companies').select('id').eq('id', companyCheck.value as string).maybeSingle()
  if (!company) return NextResponse.json({ error: 'Company not found — it may have been deleted.' }, { status: 400 })

  const insert: Record<string, unknown> = { company_id: companyCheck.value, name: nameCheck.value }
  for (const f of CREATE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeContactField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    insert[f] = check.value
  }

  const { data, error } = await supabaseAdmin.from('contacts').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, contact: data })
}
