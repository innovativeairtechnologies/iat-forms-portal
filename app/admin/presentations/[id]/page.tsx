import { notFound } from 'next/navigation'
import { getPresentation, getPresentationItems, getLibraryBlocks } from '@/lib/presentations-data'
import BuilderClient from './BuilderClient'

export const dynamic = 'force-dynamic'

export default async function PresentationBuilderPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const [presentation, items, library] = await Promise.all([
    getPresentation(id),
    getPresentationItems(id),
    getLibraryBlocks(),
  ])
  if (!presentation) notFound()

  return <BuilderClient presentation={presentation} initialItems={items} library={library} />
}
