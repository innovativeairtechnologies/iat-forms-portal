import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import FormRenderer from '@/components/FormRenderer'

async function getForm(slug: string) {
  const { data: form } = await supabase
    .from('forms').select('*').eq('slug', slug).eq('is_active', true).single()
  if (!form) return null
  const { data: fields } = await supabase
    .from('form_fields').select('*').eq('form_id', form.id).order('sort_order')
  return { form, fields: fields || [] }
}

export const revalidate = 60

export default async function EmbedPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const result = await getForm(params.slug)
  if (!result) notFound()
  return <FormRenderer form={result.form} fields={result.fields} embedded={true} />
}
