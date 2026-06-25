import { notFound, redirect } from 'next/navigation'
import EquipmentTicketForm from '@/components/support/EquipmentTicketForm'
import { getSupportCustomerContext } from '@/lib/support-context'

// The Troubleshooting Checklist was merged into the Equipment Support Ticket
// (2026-06-24) — there's now ONE unified support form.
const SUPPORT_FORMS = new Set(['equipment-support'])

// Retired slugs → the merged form, so old links / bookmarks still resolve.
const REDIRECTS: Record<string, string> = {
  troubleshooting: '/support/equipment-support',
}

// Session-aware: a signed-in portal customer gets their account + units prefilled,
// so this renders per-request. Anonymous (non-portal) visitors still get the plain
// public form — /support is NOT gated.
export const dynamic = 'force-dynamic'

export default async function SupportFormPage(props: { params: Promise<{ form: string }> }) {
  const params = await props.params
  const dest = REDIRECTS[params.form]
  if (dest) redirect(dest)
  if (!SUPPORT_FORMS.has(params.form)) notFound()

  const customerContext = await getSupportCustomerContext()
  return <EquipmentTicketForm customerContext={customerContext} />
}
