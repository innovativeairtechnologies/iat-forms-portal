import StepFormModal from '@/components/StepFormModal'

export default async function FormPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  return <StepFormModal slug={params.slug} />
}
