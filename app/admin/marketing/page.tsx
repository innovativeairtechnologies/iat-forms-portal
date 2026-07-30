import { supabaseAdmin } from '@/lib/supabase-admin'
import type { MarketingEvent } from '@/lib/supabase'
import MarketingClient from './MarketingClient'

/* /admin/marketing — the marketing content calendar (migration 071). Page authz
   is middleware's job (canAccessAdminPath → 'marketing_calendar'), so there's no
   guard call here; that's the house pattern (see production/page.tsx).

   The whole table is loaded rather than a month window: this is tens of rows a
   year, and holding it all client-side makes month paging instant and keeps the
   grid honest when a save lands in a month you aren't looking at. Revisit if it
   ever grows past a few thousand.

   Pre-migration the query errors and we start empty — the panel's first write
   is what surfaces the migration hint, as a 503 with instructions. */

export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
  const { data } = await supabaseAdmin
    .from('marketing_events')
    .select('*')
    .order('event_date')

  return <MarketingClient initialEvents={(data ?? []) as MarketingEvent[]} />
}
