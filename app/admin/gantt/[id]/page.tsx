import { notFound } from 'next/navigation'
import { getChart } from '@/lib/gantt-data'
import GanttEditorClient from './GanttEditorClient'

export const dynamic = 'force-dynamic'

export default async function GanttEditorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const chart = await getChart(id)
  if (!chart) notFound()
  return <GanttEditorClient initial={chart} />
}
