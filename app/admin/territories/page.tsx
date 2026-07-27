export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import TerritoriesClient from './TerritoriesClient'
import type { Company, Contact, CompanyLocation, CompanyTerritory } from '@/lib/supabase'

/* The rep territory map (migration 068, replaces Mapline). Page authz is
   middleware's job (canAccessAdminPath → 'deals'), so there's no guard call
   here; that's the house pattern (see tool-crib/page.tsx). getAdminSurfaceUser
   is only read for the ROLE: the "admin and sales only" edit restriction is
   enforced server-side by requireTerritoryAuth({ write: true }) — canEdit just
   keeps the UI honest so other deals-holding roles don't see controls that 403.

   Rep firms are `companies` rows with kind='rep_firm' (the dormant CRM layer,
   migration 062); contacts/territories/locations are filtered to those firms —
   prospect/customer companies never reach this page. */

export default async function TerritoriesPage() {
  const [surfaceUser, companiesQ, contactsQ, territoriesQ, locationsQ] = await Promise.all([
    getAdminSurfaceUser(),
    supabaseAdmin.from('companies').select('*').eq('kind', 'rep_firm').order('name'),
    supabaseAdmin.from('contacts').select('*').order('name'),
    supabaseAdmin.from('company_territories').select('*'),
    supabaseAdmin.from('company_locations').select('*'),
  ])

  const companies = (companiesQ.data ?? []) as Company[]
  const firmIds = new Set(companies.map((c) => c.id))
  const contacts = ((contactsQ.data ?? []) as Contact[]).filter((k) => firmIds.has(k.company_id))
  const territories = ((territoriesQ.data ?? []) as CompanyTerritory[]).filter((t) => firmIds.has(t.company_id))
  const locations = ((locationsQ.data ?? []) as CompanyLocation[]).filter((l) => firmIds.has(l.company_id))

  const canEdit = surfaceUser?.role === 'admin' || surfaceUser?.role === 'sales'

  return (
    // flex-1 fills the layout column (viewport minus the mobile top bar) — a
    // hard h-screen would overflow by the bar's 56px and clip the map canvas
    // (org-chart precedent).
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <TerritoriesClient
        initialCompanies={companies}
        initialContacts={contacts}
        initialLocations={locations}
        initialTerritories={territories}
        canEdit={canEdit}
      />
    </div>
  )
}
