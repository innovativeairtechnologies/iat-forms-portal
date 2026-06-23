import { notFound } from 'next/navigation'
import EquipmentTicketForm from '@/components/support/EquipmentTicketForm'

// Registry of customer support forms. Each slug maps to its wizard component.
// Today there is one (equipment support); add new ticket types here as they're built.
// This sets the /support/[form-name] template without a generic form engine yet.
const SUPPORT_FORMS: Record<string, { component: React.ComponentType }> = {
  'equipment-support': { component: EquipmentTicketForm },
}

export function generateStaticParams() {
  return Object.keys(SUPPORT_FORMS).map(form => ({ form }))
}

export default async function SupportFormPage(props: { params: Promise<{ form: string }> }) {
  const params = await props.params;
  const entry = SUPPORT_FORMS[params.form]
  if (!entry) notFound()
  const FormComponent = entry.component
  return <FormComponent />
}
