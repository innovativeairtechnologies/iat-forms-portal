import { redirect } from 'next/navigation'
import { getCustomerUser } from '@/lib/customer-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { effectiveWarrantyEnd, warrantyState, daysUntilWarrantyEnd } from '@/lib/equipment'
import { milestoneProgress } from '@/lib/customer'
import CustomerDashboard, {
  type UnitView,
  type RequestView,
  type DashboardKb,
} from '@/components/customer/CustomerDashboard'
import type { Equipment, EquipmentMilestone, Ticket, TroubleshootingIntake } from '@/lib/supabase'

// Always reflect the latest build/ship status and request history for this login.
export const dynamic = 'force-dynamic'

export default async function CustomerHome() {
  const session = await getCustomerUser()
  if (!session) redirect('/login')

  const { customerId, customer, displayName, user } = session
  const email = (user.email || customer.contact_email || '').toLowerCase()

  // ── This customer's equipment ──────────────────────────────────────────────
  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
  const units = (equipmentData || []) as Equipment[]
  const unitIds = units.map((u) => u.id)
  const serials = units.map((u) => u.serial_number).filter(Boolean)

  // ── Build/ship milestones for those units ──────────────────────────────────
  const milestonesByUnit: Record<string, EquipmentMilestone[]> = {}
  if (unitIds.length) {
    const { data: ms } = await supabaseAdmin
      .from('equipment_milestones')
      .select('*')
      .in('equipment_id', unitIds)
      .order('sort_order', { ascending: true })
    for (const m of (ms || []) as EquipmentMilestone[]) {
      ;(milestonesByUnit[m.equipment_id] ||= []).push(m)
    }
  }

  // ── Support history (tickets + troubleshooting) for their units/email ──────
  const orParts: string[] = []
  if (email) orParts.push(`customer_email.ilike.${email}`)
  if (serials.length) orParts.push(`serial_number.in.(${serials.join(',')})`)
  const orFilter = orParts.join(',')

  let tickets: Ticket[] = []
  let intakes: TroubleshootingIntake[] = []
  if (orFilter) {
    const [tRes, iRes] = await Promise.all([
      supabaseAdmin.from('tickets').select('*').or(orFilter).order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('troubleshooting_intakes').select('*').or(orFilter).order('created_at', { ascending: false }).limit(50),
    ])
    tickets = (tRes.data || []) as Ticket[]
    intakes = (iRes.data || []) as TroubleshootingIntake[]
  }

  // ── Knowledge base (published) ─────────────────────────────────────────────
  const { data: kbData } = await supabaseAdmin
    .from('kb_articles')
    .select('title, slug, excerpt, category')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(6)

  // ── Shape view models ──────────────────────────────────────────────────────
  const unitViews: UnitView[] = units.map((u) => {
    const ms = (milestonesByUnit[u.id] || []).sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: u.id,
      serial_number: u.serial_number,
      model_number: u.model_number,
      voltage: u.voltage,
      location: u.location,
      ship_date: u.ship_date,
      install_date: u.install_date,
      photos: u.photo_urls || [],
      milestones: ms,
      warranty: {
        state: warrantyState(u),
        end: effectiveWarrantyEnd(u),
        daysLeft: daysUntilWarrantyEnd(u),
      },
      progress: milestoneProgress(ms),
    }
  })

  const requests: RequestView[] = [
    ...tickets.map((t) => ({
      kind: 'ticket' as const,
      ref: t.ticket_number,
      title: t.problem_description,
      serial: t.serial_number,
      status: t.status as string,
      created_at: t.created_at,
    })),
    ...intakes.map((i) => ({
      kind: 'troubleshooting' as const,
      ref: i.reference_number,
      title: i.problem_description,
      serial: i.serial_number,
      status: i.status as string,
      created_at: i.created_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const kb = (kbData || []) as DashboardKb[]

  return (
    <CustomerDashboard
      companyName={customer.company_name}
      contactName={displayName}
      email={email}
      units={unitViews}
      requests={requests}
      kb={kb}
    />
  )
}
