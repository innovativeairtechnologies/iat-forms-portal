import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ProductionDepartment, ProductionPerson, ProductionTask } from '@/lib/supabase'
import { shopDate } from '@/lib/production'
import DeptDetailClient from './DeptDetailClient'

export const dynamic = 'force-dynamic'

export default async function DeptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: dept }, { data: tasks }, { data: people }] = await Promise.all([
    supabaseAdmin.from('production_departments').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('production_tasks')
      .select('*')
      .eq('department_id', id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('production_people')
      .select('*')
      .eq('department_id', id)
      .order('sort_order', { ascending: true }),
  ])

  if (!dept) notFound()

  return (
    <DeptDetailClient
      department={dept as ProductionDepartment}
      tasks={(tasks ?? []) as ProductionTask[]}
      people={(people ?? []) as ProductionPerson[]}
      today={shopDate()}
    />
  )
}
