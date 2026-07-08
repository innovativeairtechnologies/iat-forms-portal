import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'
import {
  SRV_SECTIONS,
  srvFormFieldDefs,
  itemFieldLabel,
  readingFieldLabel,
  photoFieldLabel,
  sectionHeaderLabel,
  sectionAppliesLabel,
  sectionNotesLabel,
  type SrvSection,
} from './srv'

// ─────────────────────────────────────────────────────────────────────────────
// lib/srv-config.ts — the DB-backed SRV content (migration 046).
//
// The SRV section content is editable live from /admin/srv. This reads/writes
// the single srv_config row and FALLS BACK to the code default (SRV_SECTIONS)
// whenever no row is saved / the row is malformed / the read errors, so
// /customer/srv always renders. Server-only (service-role); lib/srv.ts stays
// pure + client-safe.
// ─────────────────────────────────────────────────────────────────────────────

const SRV_CONFIG_ID = 1

export const getSrvSections = cache(async (): Promise<SrvSection[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('srv_config')
      .select('sections')
      .eq('id', SRV_CONFIG_ID)
      .maybeSingle()
    if (error || !data?.sections) return SRV_SECTIONS
    const sections = data.sections as SrvSection[]
    if (!Array.isArray(sections) || sections.length === 0) return SRV_SECTIONS
    return sections
  } catch {
    return SRV_SECTIONS
  }
})

export async function saveSrvSections(sections: SrvSection[], updatedBy: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('srv_config')
    .upsert({ id: SRV_CONFIG_ID, sections, updated_at: new Date().toISOString(), updated_by: updatedBy })
  if (error) throw new Error(error.message)
}

/**
 * Validate an edited sections array against the current (`reference`) sections.
 * Returns an error string, or null if OK. Guards two things the customer SRV +
 * 3D depend on:
 *  - The section SKELETON is unchanged: same keys, numbers, and conditionals (no
 *    adding/removing/renaming sections — their keys drive the 3D hotspot map and
 *    the numbering). Only section content (titles, items, readings, photos) is
 *    editable here.
 *  - The FLATTENED field labels stay globally unique. submissions.data is one
 *    flat object keyed by these labels, so a collision would corrupt data. We
 *    seed the reserved set with the fixed form labels (summary, project, config,
 *    certification, section headers/notes) so an item can't shadow them either.
 */
export function validateSrvSections(incoming: unknown, reference: SrvSection[]): string | null {
  if (!Array.isArray(incoming)) return 'Sections must be a list.'
  const sections = incoming as SrvSection[]

  if (sections.length !== reference.length) {
    return 'Adding or removing whole sections is not supported here.'
  }
  // Every incoming section key must be a known reference key AND unique. With
  // length === reference.length already enforced, "all valid + all unique" means
  // it's a bijection onto the reference set — so no section can be dropped by
  // duplicating another (which a length-only check would miss).
  const refByKey = new Map(reference.map((s) => [s.key, s]))
  const seenSectionKeys = new Set<string>()
  for (const s of sections) {
    if (!s || typeof s !== 'object') return 'Malformed section.'
    const ref = refByKey.get(s.key)
    if (!ref) return `Unknown or renamed section key "${s.key}" — section keys can't change.`
    if (seenSectionKeys.has(s.key)) return `Section "${s.key}" appears more than once.`
    seenSectionKeys.add(s.key)
    if (s.number !== ref.number) return `The number for section "${s.key}" can't change.`
    if (JSON.stringify(s.conditional ?? null) !== JSON.stringify(ref.conditional ?? null)) {
      return `The "applies to this unit" condition for section ${ref.number} can't change.`
    }
    if (!s.title?.trim() || !s.shortTitle?.trim() || !s.locationHint?.trim()) {
      return `Section ${ref.number} needs a title, short title, and location hint.`
    }
    if (!Array.isArray(s.groups) || !Array.isArray(s.photos)) return `Section ${ref.number} is malformed.`
  }

  // Reserved labels: the fixed (non-section) form fields + every section's
  // structural labels. Content labels are then checked against this set.
  const labels = new Set<string>(srvFormFieldDefs([]).map((f) => f.label))
  for (const s of sections) {
    labels.add(sectionHeaderLabel(s))
    if (s.conditional) labels.add(sectionAppliesLabel(s))
    labels.add(sectionNotesLabel(s))
  }

  // Keys must be unique across ALL items/readings/photos in the form — answers
  // are keyed by these, so a collision would bind two fields to one slot.
  const keys = new Set<string>()
  for (const s of sections) {
    for (const g of s.groups) {
      if (!Array.isArray(g.items)) return `A group in section ${s.number} is malformed.`
      for (const it of g.items) {
        if (!it.key?.trim() || !it.label?.trim()) return `Every checklist item needs a name (section ${s.number}).`
        if (keys.has(it.key)) return `Duplicate field key "${it.key}".`
        keys.add(it.key)
        const lbl = itemFieldLabel(g, it)
        if (labels.has(lbl)) return `Two fields would share the label "${lbl}" — rename one (a group title disambiguates repeats).`
        labels.add(lbl)
      }
    }
    for (const r of s.readings || []) {
      if (!r.key?.trim() || !r.label?.trim() || !r.unit?.trim()) return `Every reading needs a name and a unit (section ${s.number}).`
      if (keys.has(r.key)) return `Duplicate field key "${r.key}".`
      keys.add(r.key)
      const lbl = readingFieldLabel(r)
      if (labels.has(lbl)) return `Two fields would share the label "${lbl}".`
      labels.add(lbl)
    }
    for (const p of s.photos) {
      if (!p.key?.trim() || !p.label?.trim()) return `Every photo needs a name (section ${s.number}).`
      if (keys.has(p.key)) return `Duplicate field key "${p.key}".`
      keys.add(p.key)
      const lbl = photoFieldLabel(p)
      if (labels.has(lbl)) return `Two fields would share the label "${lbl}".`
      labels.add(lbl)
    }
  }
  return null
}
