'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'

/* CRUD for the company-home (/home) editorial content. Service-role writes, so
   each guards the caller with the 'home_content' permission (admin by default,
   delegatable via /admin/permissions) rather than trusting middleware alone —
   same model as the org-chart / presentations actions. */

async function requireHomeContent() {
  const admin = await getAdminSurfaceUser()
  if (!admin || !admin.can('home_content')) throw new Error('Forbidden')
  return admin
}

function revalidate() {
  revalidatePath('/admin/home-content')
  revalidatePath('/home')
}

const clean = (s: unknown) => {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length ? t : null
}
const req = (s: unknown, field: string) => {
  const t = clean(s)
  if (!t) throw new Error(`${field} is required.`)
  return t
}

// ── Announcements (Company News) ──────────────────────────────────────────────
export type AnnouncementInput = {
  id?: string; title: string; body?: string; category?: string; pinned?: boolean; published_at?: string
}
export async function saveAnnouncement(input: AnnouncementInput): Promise<void> {
  await requireHomeContent()
  const row = {
    title: req(input.title, 'Title'),
    body: clean(input.body),
    category: clean(input.category),
    pinned: !!input.pinned,
    published_at: clean(input.published_at) || new Date().toISOString(),
  }
  const { error } = input.id
    ? await supabaseAdmin.from('announcements').update(row).eq('id', input.id)
    : await supabaseAdmin.from('announcements').insert(row)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Company events (Calendar) ─────────────────────────────────────────────────
export type EventInput = {
  id?: string; title: string; description?: string; starts_on: string; ends_on?: string; kind?: string
}
export async function saveEvent(input: EventInput): Promise<void> {
  await requireHomeContent()
  const row = {
    title: req(input.title, 'Title'),
    description: clean(input.description),
    starts_on: req(input.starts_on, 'Start date'),
    ends_on: clean(input.ends_on),
    kind: clean(input.kind) || 'event',
  }
  const { error } = input.id
    ? await supabaseAdmin.from('company_events').update(row).eq('id', input.id)
    : await supabaseAdmin.from('company_events').insert(row)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Job openings (Open Positions) ─────────────────────────────────────────────
export type OpeningInput = {
  id?: string; title: string; department?: string; location?: string
  employment_type?: string; description?: string; apply_url?: string; is_open?: boolean; sort?: number
}
export async function saveOpening(input: OpeningInput): Promise<void> {
  await requireHomeContent()
  const row = {
    title: req(input.title, 'Title'),
    department: clean(input.department),
    location: clean(input.location),
    employment_type: clean(input.employment_type),
    description: clean(input.description),
    apply_url: clean(input.apply_url),
    is_open: input.is_open ?? true,
    sort: Number.isFinite(input.sort) ? Number(input.sort) : 0,
  }
  const { error } = input.id
    ? await supabaseAdmin.from('job_openings').update(row).eq('id', input.id)
    : await supabaseAdmin.from('job_openings').insert(row)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Employee spotlights (Spotlight + New Employee welcome) ────────────────────
export type SpotlightInput = {
  id?: string; employee_id: string; kind?: string; headline?: string; blurb?: string; active?: boolean
}
export async function saveSpotlight(input: SpotlightInput): Promise<void> {
  await requireHomeContent()
  const row = {
    employee_id: req(input.employee_id, 'Employee'),
    kind: input.kind === 'welcome' ? 'welcome' : 'spotlight',
    headline: clean(input.headline),
    blurb: clean(input.blurb),
    active: input.active ?? true,
  }
  const { error } = input.id
    ? await supabaseAdmin.from('employee_spotlights').update(row).eq('id', input.id)
    : await supabaseAdmin.from('employee_spotlights').insert(row)
  if (error) throw new Error(error.message)
  revalidate()
}

// ── Delete (shared) ───────────────────────────────────────────────────────────
const TABLES = {
  announcements: 'announcements',
  events: 'company_events',
  openings: 'job_openings',
  spotlights: 'employee_spotlights',
} as const
export type ContentTable = keyof typeof TABLES

export async function deleteContent(table: ContentTable, id: string): Promise<void> {
  await requireHomeContent()
  const { error } = await supabaseAdmin.from(TABLES[table]).delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidate()
}
