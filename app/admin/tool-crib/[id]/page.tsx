import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CribTool, CribEvent } from '@/lib/supabase'
import ToolDetailClient from './ToolDetailClient'

export const dynamic = 'force-dynamic'

export type EmployeeOption = { id: string; name: string }

export default async function ToolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: tool }, { data: events }, { data: employees }] = await Promise.all([
    supabaseAdmin
      .from('crib_tools')
      .select('*, holder:employees!crib_tools_held_by_fkey(name)')
      .eq('id', id)
      .single(),
    supabaseAdmin
      .from('crib_events')
      .select('*')
      .eq('tool_id', id)
      .order('created_at', { ascending: false }),
    // Transfer targets. Inactive employees are excluded — handing a tool to a
    // deactivated account would create custody nobody can clear by scanning.
    supabaseAdmin
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  if (!tool) notFound()

  const { holder, ...row } = tool as CribTool & { holder: { name: string } | null }

  return (
    <ToolDetailClient
      tool={row as CribTool}
      holderName={row.held_by ? (holder?.name ?? null) : null}
      events={(events ?? []) as CribEvent[]}
      employees={(employees ?? []) as EmployeeOption[]}
    />
  )
}
