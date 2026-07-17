import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  ProductionDepartment,
  ProductionPerson,
  ProductionProject,
  ProductionTask,
} from '@/lib/supabase'
import { shopDate } from '@/lib/production'
import ProjectDetailClient from './ProjectDetailClient'

export const dynamic = 'force-dynamic'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>
}) {
  const { id, projectId } = await params

  const [{ data: dept }, { data: project }, { data: tasks }, { data: people }] = await Promise.all([
    supabaseAdmin.from('production_departments').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('production_projects')
      .select('*')
      .eq('id', projectId)
      .eq('department_id', id) // the project must belong to this department
      .is('archived_at', null)
      .maybeSingle(),
    supabaseAdmin
      .from('production_tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('production_people')
      .select('*')
      .eq('department_id', id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  if (!dept || !project) notFound()

  return (
    <ProjectDetailClient
      department={dept as ProductionDepartment}
      project={project as ProductionProject}
      tasks={(tasks ?? []) as ProductionTask[]}
      people={(people ?? []) as ProductionPerson[]}
      today={shopDate()}
    />
  )
}
