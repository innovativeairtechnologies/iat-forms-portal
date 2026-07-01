import { notFound } from 'next/navigation'
import { getPresentation, getPresentationItems } from '@/lib/presentations-data'
import type { PresentationBlock } from '@/lib/presentations'
import PresentClient from './PresentClient'

export const dynamic = 'force-dynamic'

export default async function PresentPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [presentation, items] = await Promise.all([getPresentation(id), getPresentationItems(id)])
  if (!presentation) notFound()
  const blocks = items.map((i) => i.block).filter(Boolean) as PresentationBlock[]

  return <PresentClient presentationId={id} title={presentation.title} blocks={blocks} />
}
