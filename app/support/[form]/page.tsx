import { notFound, redirect } from 'next/navigation'
import EquipmentTicketForm from '@/components/support/EquipmentTicketForm'

// Registry of customer support forms. Each slug maps to its wizard component.
// The Troubleshooting Checklist was merged into the Equipment Support Ticket
// (2026-06-24) — there's now ONE unified support form.
const SUPPORT_FORMS: Record<string, { component: React.ComponentType }> = {
  'equipment-support': { component: EquipmentTicketForm },
}

// Retired slugs → the merged form, so old links / bookmarks still resolve.
const REDIRECTS: Record<string, string> = {
  'troubleshooting': '/support/equipment-support',
}

export function generateStaticParams() {
  return Object.keys(SUPPORT_FORMS).map(form => ({ form }))
}

export default async function SupportFormPage(props: { params: Promise<{ form: string }> }) {
  const params = await props.params
  const dest = REDIRECTS[params.form]
  if (dest) redirect(dest)
  const entry = SUPPORT_FORMS[params.form]
  if (!entry) notFound()
  const FormComponent = entry.component
  return <FormComponent />
}
