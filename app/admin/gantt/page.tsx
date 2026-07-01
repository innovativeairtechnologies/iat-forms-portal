import { listCharts } from '@/lib/gantt-data'
import GanttListClient from './GanttListClient'

export const dynamic = 'force-dynamic'

export default async function GanttPage() {
  const charts = await listCharts()
  return <GanttListClient charts={charts} />
}
