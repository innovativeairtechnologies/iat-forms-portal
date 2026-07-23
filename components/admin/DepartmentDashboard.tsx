import { supabaseAdmin } from '@/lib/supabase-admin'
import { hasPermission, ROLE_LABELS, ROLE_DESCRIPTIONS, type Perm } from '@/lib/roles'
import { getPermMatrix } from '@/lib/permissions'
import { getLayout } from '@/lib/dashboard-layouts'
import { getExecData } from '@/lib/exec-dashboard-data'
import DashboardGrid from '@/components/dashboards/DashboardGrid'
import {
  CARD_REGISTRY, computeQuickLinks, defaultLayout,
  type CardCtx, type DeptRole, type RenderedCard, type LayoutItem,
} from '@/components/dashboards/dept-cards'

/* ────────────────────────────────────────────────────────────────────────────
   /admin for a SCOPED role (hr / marketing / engineering / production_manager).
   The executive dashboard (app/admin/page.tsx) stays admin-only and Sales has its
   own command center; this is the warm-bento department dashboard every other
   scoped role lands on.

   Now a per-user "build your own dashboard": every card the role can access is
   rendered server-side and handed to the client <DashboardGrid>, which places
   them per the user's SAVED layout (dashboard_layouts, migration 067) or the code
   default, and lets the user add / remove / reorder / resize cards in edit mode.
   Cards are permission-gated from the shared registry (components/dashboards/
   dept-cards.tsx), so /admin/permissions still reshapes what's available with no
   code change. A user with no saved row sees exactly the default arrangement.
   ──────────────────────────────────────────────────────────────────────────── */

export default async function DepartmentDashboard({ role, displayName, userId, preview = false }: { role: DeptRole; displayName: string; userId: string; preview?: boolean }) {
  const matrix = await getPermMatrix()
  const can = (p: Perm) => hasPermission(role, p, matrix)
  const quickLinks = computeQuickLinks(role, matrix)
  // Admin's cards read one shared exec-data batch; scoped roles don't need it.
  const [{ count: headcount }, execData] = await Promise.all([
    supabaseAdmin.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
    role === 'admin' ? getExecData() : Promise.resolve(undefined),
  ])

  const ctx: CardCtx = { role, can, headcount: headcount ?? 0, quickLinks, execData }

  // Render every card the role can access up front (data loaded server-side), so
  // the client editor can add/remove any of them without a round-trip.
  const accessible = CARD_REGISTRY.filter((c) => c.available(ctx))
  const rendered: RenderedCard[] = await Promise.all(
    accessible.map(async (c) => ({ id: c.id, title: c.title, defaultSpan: c.defaultSpan, sizes: c.sizes, node: await c.Component(ctx) })),
  )

  // Resolve the layout: the user's saved one (dropping any cards they can no
  // longer see) or the code default. Fall back to default if the saved set emptied.
  const dflt = defaultLayout(ctx)
  const accessibleIds = new Set(rendered.map((r) => r.id))
  const saved = preview ? null : await getLayout(userId)
  const resolved: LayoutItem[] = (saved ?? dflt).filter((it) => accessibleIds.has(it.id))
  const layout = resolved.length > 0 ? resolved : dflt

  return (
    <div className="relative isolate flex-1 overflow-y-auto overflow-x-hidden bg-canvas text-ink-secondary min-h-0">
      {/* Ambient emerald/sky wash — the same warmth signature the exec dashboard carries. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute -top-40 right-[-120px] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-emerald-400/20 via-emerald-500/8 to-transparent blur-3xl dark:from-emerald-500/16 dark:via-emerald-600/6" />
      </div>

      <div className="p-5 space-y-5 animate-fade-up">

        {/* Greeting hero — warm surface band with the emerald brand glow. */}
        <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface px-6 py-6 sm:px-8">
          <div
            className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full opacity-[0.18] blur-3xl dark:opacity-25"
            style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{ROLE_LABELS[role]} · Dashboard</p>
              <h1 className="mt-1 text-[24px] font-semibold text-ink leading-tight tracking-[-0.02em]">
                {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
              </h1>
              <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 self-start text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          </div>
        </section>

        {/* The customizable card grid (view + edit modes; read-only in preview). */}
        <DashboardGrid cards={rendered} initialLayout={layout} defaultLayout={dflt} readOnly={preview} />

        <p className="text-[11px] text-ink-faint text-center pt-1 pb-4">
          Live data from your Supabase instance · arrange your cards with “Edit dashboard”
        </p>
      </div>
    </div>
  )
}
