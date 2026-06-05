import StepFormModal from '@/components/StepFormModal'

export default function FormPage({ params }: { params: { slug: string } }) {
  return <StepFormModal slug={params.slug} />
}
