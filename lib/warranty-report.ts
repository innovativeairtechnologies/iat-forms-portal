import { supabaseAdmin } from '@/lib/supabase-admin'
import { type Bucket, type RangeKey, rangeFor, tally } from '@/lib/report-shared'
import { daysUntilWarrantyEnd, effectiveWarrantyEnd, warrantyState } from '@/lib/equipment'

/* Installed base and warranty (/admin/reports/warranty).

   The useful output here is not a chart, it is a LIST: which units come off
   warranty in the next 90 days, with the customer beside each one. That is a
   call sheet for the aftermarket, which the strategic notes call the biggest
   opening the portal has.

   ⚠️ Warranty state is computed by lib/equipment.ts, never re-derived here.
   effectiveWarrantyEnd() prefers an explicit warranty_end and otherwise counts
   warranty_months forward from SHIP date, defaulting to 12 months when none is
   set. It does NOT consider install_date, despite that column existing.
   Re-implementing any of that inline is how a report and a product page end up
   disagreeing about whether a machine is covered.

   ⚠️ The range filter applies to SHIP DATE, so it answers "what did we ship in
   this window". The expiry list deliberately ignores it: a unit shipped three
   years ago expiring next month is exactly what you want to see, and a date
   filter would hide it. */

export type EquipRow = {
  id: string
  serial: string
  model: string
  company: string
  contact: string
  location: string
  shipDate: string
  installDate: string
  warrantyEnd: string
  state: 'in' | 'out' | 'unknown'
  daysLeft: number | null
  status: string
}

export type WarrantyReport = {
  rangeKey: RangeKey
  rangeLabel: string
  totals: {
    units: number
    inWarranty: number
    outOfWarranty: number
    unknown: number
    expiring90: number
    shippedInRange: number
  }
  expiringSoon: Bucket[]
  byState: Bucket[]
  byModel: Bucket[]
  byCompany: Bucket[]
  byShipYear: Bucket[]
  rows: EquipRow[]
}

const EXPIRY_HORIZON_DAYS = 90

export async function buildWarrantyReport(rangeKey: RangeKey, now: Date = new Date()): Promise<WarrantyReport> {
  const range = rangeFor(rangeKey, now)

  const { data, error } = await supabaseAdmin
    .from('equipment')
    .select('id, serial_number, model_number, customer_company, customer_name, location, ship_date, install_date, warranty_months, warranty_end, status')
    .limit(20000)

  if (error) console.error('[warranty-report] read failed:', error.message)

  const rows: EquipRow[] = (data ?? []).map(e => {
    // Exactly the fields lib/equipment.ts reads — no install_date, which it
    // ignores. A null warranty_months is defaulted by the helper itself, so it
    // is passed straight through rather than defaulted twice in two places.
    const input = {
      ship_date: e.ship_date as string | null,
      warranty_months: e.warranty_months as number,
      warranty_end: e.warranty_end as string | null,
    }
    return {
      id: e.id as string,
      serial: ((e.serial_number as string) ?? '').trim(),
      model: ((e.model_number as string) ?? '').trim(),
      company: ((e.customer_company as string) ?? '').trim(),
      contact: ((e.customer_name as string) ?? '').trim(),
      location: ((e.location as string) ?? '').trim(),
      shipDate: ((e.ship_date as string) ?? '').trim(),
      installDate: ((e.install_date as string) ?? '').trim(),
      warrantyEnd: effectiveWarrantyEnd(input) ?? '',
      state: warrantyState(input),
      daysLeft: daysUntilWarrantyEnd(input),
      status: ((e.status as string) ?? '').trim(),
    }
  })

  const shippedInRange = rows.filter(r => r.shipDate && (!range.from || new Date(r.shipDate) >= range.from))

  // The call sheet. Soonest first — this is a worklist, not a distribution.
  const expiring = rows
    .filter(r => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= EXPIRY_HORIZON_DAYS)
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))

  return {
    rangeKey: range.key,
    rangeLabel: range.label,
    totals: {
      units: rows.length,
      inWarranty: rows.filter(r => r.state === 'in').length,
      outOfWarranty: rows.filter(r => r.state === 'out').length,
      unknown: rows.filter(r => r.state === 'unknown').length,
      expiring90: expiring.length,
      shippedInRange: shippedInRange.length,
    },
    expiringSoon: expiring.map(r => ({
      label: `${r.company || 'Unknown customer'} · ${r.model || 'model?'} · ${r.serial || 'serial?'}`,
      count: r.daysLeft ?? 0,
      note: r.warrantyEnd,
    })),
    byState: [
      { label: 'In warranty', count: rows.filter(r => r.state === 'in').length },
      { label: 'Out of warranty', count: rows.filter(r => r.state === 'out').length },
      { label: 'No warranty data', count: rows.filter(r => r.state === 'unknown').length },
    ],
    byModel: tally(rows.map(r => r.model), 'No model recorded').slice(0, 15),
    byCompany: tally(rows.map(r => r.company), 'No company recorded').slice(0, 15),
    byShipYear: tally(rows.map(r => (r.shipDate ? r.shipDate.slice(0, 4) : '')), 'No ship date')
      .sort((a, b) => a.label.localeCompare(b.label)),
    rows,
  }
}
