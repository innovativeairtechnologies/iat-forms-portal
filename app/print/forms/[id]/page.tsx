export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { FormField } from '@/lib/supabase'
import BlankFormPrint from './BlankFormPrint'

async function getData(id: string) {
  const { data: form } = await supabaseAdmin.from('forms').select('id, title, description').eq('id', id).single()
  if (!form) return null
  const { data: fields } = await supabaseAdmin.from('form_fields').select('*').eq('form_id', id).order('sort_order')
  return { form, fields: (fields || []) as FormField[] }
}

export default async function FormPrintPage(props: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) redirect('/login')
  const { id } = await props.params
  const data = await getData(id)
  if (!data) notFound()
  const { form, fields } = data

  // The field that gates conditional questions (e.g. "Department" on the Performance
  // Review). Derived from the data so this page works for any conditional form.
  const controllingLabel =
    [...new Set(fields.filter((f) => f.show_when_field).map((f) => f.show_when_field as string))][0] ?? null

  let departments: string[] = []
  if (controllingLabel) {
    const ctrl = fields.find((f) => f.label === controllingLabel)
    departments = ctrl?.options?.length
      ? ctrl.options
      : [...new Set(fields.filter((f) => f.show_when_field === controllingLabel && f.show_when_value).map((f) => f.show_when_value as string))]
  }

  return (
    <BlankFormPrint
      formId={form.id}
      title={form.title}
      description={form.description}
      fields={fields}
      controllingLabel={controllingLabel}
      departments={departments}
    />
  )
}
