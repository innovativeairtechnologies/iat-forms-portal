import { supabaseAdmin } from '@/lib/supabase-admin'
import CustomersClient from './CustomersClient'
import type { CustomerPortalRequestRow } from './CustomerRequestsQueue'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const [{ data: customers }, { data: equipment }, { data: requestRows }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('equipment').select('id, customer_id'),
    supabaseAdmin.from('customer_portal_requests').select('*').order('created_at', { ascending: false }),
  ])

  // Units owned per customer → the "Units" column.
  const unitCounts: Record<string, number> = {}
  for (const e of equipment ?? []) {
    if (e.customer_id) unitCounts[e.customer_id] = (unitCounts[e.customer_id] ?? 0) + 1
  }

  const rows = (customers ?? []).map((c) => ({ ...c, unit_count: unitCounts[c.id] ?? 0 }))

  // Join tickets + suggested customer in manually — avoids the ambiguous-FK
  // aliased embed (customer_portal_requests has two FKs into customers)
  // tripping up the untyped supabase-js query builder.
  const ticketIds = [...new Set((requestRows ?? []).map((r) => r.ticket_id).filter(Boolean))]
  const suggestedIds = [...new Set((requestRows ?? []).map((r) => r.suggested_customer_id).filter(Boolean))]
  const [{ data: reqTickets }, { data: reqCustomers }] = await Promise.all([
    ticketIds.length
      ? supabaseAdmin.from('tickets').select('id, ticket_number, serial_number, model_number, problem_description').in('id', ticketIds)
      : Promise.resolve({ data: [] }),
    suggestedIds.length
      ? supabaseAdmin.from('customers').select('id, company_name').in('id', suggestedIds)
      : Promise.resolve({ data: [] }),
  ])
  const ticketsById = new Map((reqTickets ?? []).map((t) => [t.id, t]))
  const customersById = new Map((reqCustomers ?? []).map((c) => [c.id, c]))

  const requests: CustomerPortalRequestRow[] = (requestRows ?? []).map((r) => ({
    ...r,
    tickets: ticketsById.get(r.ticket_id) ?? null,
    suggested: r.suggested_customer_id ? customersById.get(r.suggested_customer_id) ?? null : null,
  }))

  return <CustomersClient customers={rows} requests={requests} />
}
