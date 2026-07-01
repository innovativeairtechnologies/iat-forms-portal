import { supabaseAdmin } from '@/lib/supabase-admin'
import CustomersClient from './CustomersClient'
import type { CustomerPortalRequestRow } from './CustomerRequestsQueue'
import type { WarrantyRequestRow } from './WarrantyRequestsQueue'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const [{ data: customers }, { data: equipment }, { data: requestRows }, { data: warrantyRows }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('equipment').select('id, customer_id'),
    supabaseAdmin.from('customer_portal_requests').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('warranty_requests').select('*').order('created_at', { ascending: false }),
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

  // Join warranty_requests against equipment + customers + tickets manually —
  // avoids the ambiguous-FK aliased embed tripping up the untyped query builder
  // (same reasoning as the customer_portal_requests join above).
  const wCustomerIds = [...new Set((warrantyRows ?? []).map((r) => r.customer_id).filter(Boolean))]
  const wEquipmentIds = [...new Set((warrantyRows ?? []).map((r) => r.equipment_id).filter(Boolean))]
  const wTicketIds = [...new Set((warrantyRows ?? []).map((r) => r.resulting_ticket_id).filter(Boolean))]
  const [{ data: wCustomers }, { data: wEquipment }, { data: wTickets }] = await Promise.all([
    wCustomerIds.length
      ? supabaseAdmin.from('customers').select('id, company_name').in('id', wCustomerIds)
      : Promise.resolve({ data: [] }),
    wEquipmentIds.length
      ? supabaseAdmin.from('equipment').select('id, model_number').in('id', wEquipmentIds)
      : Promise.resolve({ data: [] }),
    wTicketIds.length
      ? supabaseAdmin.from('tickets').select('id, ticket_number').in('id', wTicketIds)
      : Promise.resolve({ data: [] }),
  ])
  const wCustomersById = new Map((wCustomers ?? []).map((c) => [c.id, c]))
  const wEquipmentById = new Map((wEquipment ?? []).map((e) => [e.id, e]))
  const wTicketsById = new Map((wTickets ?? []).map((t) => [t.id, t]))

  const warrantyRequests: WarrantyRequestRow[] = (warrantyRows ?? []).map((r) => ({
    ...r,
    customer: wCustomersById.get(r.customer_id) ?? null,
    equipment: wEquipmentById.get(r.equipment_id) ?? null,
    ticket: r.resulting_ticket_id ? wTicketsById.get(r.resulting_ticket_id) ?? null : null,
  }))

  return <CustomersClient customers={rows} requests={requests} warrantyRequests={warrantyRequests} />
}
