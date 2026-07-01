import { getDeckSummaries } from '@/lib/presentations-data'
import BuildsListClient from './BuildsListClient'

export const dynamic = 'force-dynamic'

export default async function PresentationsPage() {
  const decks = await getDeckSummaries()
  return <BuildsListClient decks={decks} />
}
