import { notFound, redirect } from 'next/navigation'
import { Building2, Cog, DoorOpen, Droplets, Gauge, Layers, Ruler, User } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardHead, DetailShell, DetailTopBar, Field, MetaRow } from '@/components/admin/detail-ui'
import { StatusPill } from '@/components/admin/list'
import { getEmployeesWithPerm } from '@/lib/staff'
import { isRfqStatus } from '@/lib/rfq-status'
import TriageCard from './TriageCard'
import {
  LOAD_DISCLAIMER, conditionEntered, dewPointF, fmt, fmtDewPoint, fmtGrains, grains,
  type ConditionKey, type RfqData,
} from '@/lib/rfq'

/* /admin/rfq/[id] — one submitted moisture survey.
 *
 * The SURVEY is read-only; only triage (status + internal notes, via TriageCard)
 * can be written. What the customer told us and what we told them back is a
 * record of a conversation, and a record you can quietly edit after the fact is
 * not a record.
 *
 * Renders from the STORED `data` + `summary` (migration 087). The estimate is
 * never recomputed here: `summary` is what the customer was shown and what their
 * PDF says, and the load engine will be refined — a detail page that quietly
 * disagreed with the document in their inbox would be worse than no page.
 */

export const dynamic = 'force-dynamic'

type Summary = Record<string, unknown>

export default async function RfqDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('deals')) redirect('/admin')

  const { data: row } = await supabaseAdmin
    .from('rfq_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!row) notFound()

  // The note trail and the assignable roster. Both are needed to render triage;
  // fetched together with the read-marking below so the page is one round trip.
  const [{ data: notes }, roster] = await Promise.all([
    supabaseAdmin
      .from('rfq_notes')
      .select('id, body, author_name, author_type, created_at')
      .eq('rfq_id', id)
      .order('created_at', { ascending: false }),
    getEmployeesWithPerm('deals'),
  ])

  // Reading a survey marks it read — the same convention as the submissions
  // detail page, and it is what makes the "unread" stat on the list mean anything.
  if (!row.is_read) {
    await supabaseAdmin.from('rfq_requests').update({ is_read: true }).eq('id', id)
  }

  const d = row.data as RfqData
  const s = (row.summary ?? {}) as Summary
  const isRoom = d.track === 'room'
  const elev = num(d.elevationFt)

  return (
    <DetailShell>
      <DetailTopBar crumbs={[{ label: 'Requests for Quote', href: '/admin/rfq' }, { label: row.reference }]}>
        <StatusPill tone={isRoom ? 'emerald' : 'violet'}>{isRoom ? 'Room' : 'Process'}</StatusPill>
      </DetailTopBar>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {/* The estimate, exactly as the customer saw it */}
          <Card>
            <CardHead title="The job, as we estimated it for them" icon={<Gauge size={15} />} />
            <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800 sm:grid-cols-4">
              {(isRoom
                ? [
                    ['Moisture load', s.total_lb_per_hr != null ? `${s.total_lb_per_hr} lb/hr` : '—'],
                    ['Dry air needed', s.dry_air_cfm != null ? `${Number(s.dry_air_cfm).toLocaleString()} cfm` : '—'],
                    ['Room condition', `${d.targetTempF}°F / ${d.targetRhPct}%`],
                    ['Biggest driver', String(s.dominant ?? '—')],
                  ]
                : [
                    ['Process airflow', s.cfm != null ? `${Number(s.cfm).toLocaleString()} cfm` : '—'],
                    ['Leaving air', `${d.leavingTempF}°F / ${d.leavingGrains} gr/lb`],
                    ['Leaving dew point', s.leaving_dew_point_f != null ? `${s.leaving_dew_point_f}°F` : '—'],
                    ['Water removed', s.lb_per_hr != null ? `${s.lb_per_hr} lb/hr` : '—'],
                  ]
              ).map(([label, value]) => (
                <div key={label} className="bg-white p-4 dark:bg-zinc-900/40">
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{label}</p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>
            {Array.isArray(s.breakdown) && (s.breakdown as { label: string; gr_per_hr: number }[]).length > 0 && (
              <div className="border-t border-zinc-200/70 px-5 py-4 dark:border-zinc-800/80">
                <Breakdown lines={s.breakdown as { key: string; label: string; gr_per_hr: number }[]} />
              </div>
            )}
            <p className="border-t border-zinc-200/70 px-5 py-3 text-[11px] leading-relaxed text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500">
              {LOAD_DISCLAIMER}
            </p>
          </Card>

          {isRoom ? (
            <>
              <Card>
                <CardHead title="The space" icon={<Ruler size={15} />} />
                <div className="px-5 py-1">
                  <Field label="Dimensions">{d.roomL} × {d.roomW} × {d.roomH} ft</Field>
                  <Field label="Volume">{s.volume_cu_ft != null ? `${Number(s.volume_cu_ft).toLocaleString()} cu.ft` : '—'}</Field>
                  <Field label="Target condition">
                    {d.targetTempF}°F / {d.targetRhPct}% rh
                    {' · '}{fmtGrains(grains(num(d.targetTempF), num(d.targetRhPct), elev))} gr/lb
                    {' · '}{fmtDewPoint(dewPointF(num(d.targetTempF), num(d.targetRhPct), elev))} dp
                    <Entered data={d} conditionKey="target" />
                  </Field>
                  <Field label="Surrounding space">
                    {d.surroundTempF || '—'}°F / {d.surroundRhPct || '—'}% rh
                    <Entered data={d} conditionKey="surround" />
                  </Field>
                  <Field label="Outdoor design">
                    {d.outdoorTempF || '—'}°F / {d.outdoorRhPct || '—'}% rh
                    <Entered data={d} conditionKey="outdoor" />
                    <OutdoorSource data={d} />
                  </Field>
                  <Field label="Elevation">{d.elevationFt ? `${d.elevationFt} ft ASL` : 'Not given'}</Field>
                </div>
              </Card>

              <Card>
                <CardHead title="Construction & envelope" icon={<Layers size={15} />} />
                <div className="px-5 py-1">
                  <Field label="Walls">{d.wallMaterial}</Field>
                  <Field label="Roof / ceiling">{d.ceilingMaterial}</Field>
                  <Field label="Floor">{d.floorMaterial}</Field>
                  <Field label="Vapour barrier">{d.vaporBarrier}</Field>
                  <Field label="Tightness">{d.tightness}</Field>
                </div>
              </Card>

              <Card>
                <CardHead title="Doors & openings" icon={<DoorOpen size={15} />} />
                <div className="px-5 py-1">
                  {d.doors?.length ? d.doors.map(door => (
                    <Field key={door.id} label={door.label}>
                      {door.widthFt} × {door.heightFt} ft · {door.opensPerHour}/hr · {door.secondsOpen}s open · {door.exposure}
                    </Field>
                  )) : <Field label="Openings">None recorded</Field>}
                </div>
              </Card>

              <Card>
                <CardHead title="Internal loads" icon={<Droplets size={15} />} />
                <div className="px-5 py-1">
                  <Field label="People">{d.occupants ? `${d.occupants} × ${d.activity}` : 'None recorded'}</Field>
                  <Field label="Product / process">{d.productLoadLbHr ? `${d.productLoadLbHr} lb/hr${d.productDescription ? ` — ${d.productDescription}` : ''}` : 'None recorded'}</Field>
                  <Field label="Open water">{d.wetAreaSqFt ? `${d.wetAreaSqFt} sq.ft at ${d.wetWaterTempF}°F` : 'None recorded'}</Field>
                  <Field label="Unvented combustion">{d.gasCfh ? `${d.gasCfh} cu.ft/hr` : 'None recorded'}</Field>
                  <Field label="Ventilation in">{d.ventCfm ? `${d.ventCfm} cfm` : 'None recorded'}</Field>
                  <Field label="Exhaust out">{d.exhaustCfm ? `${d.exhaustCfm} cfm` : 'None recorded'}</Field>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <CardHead title="The airstream" icon={<Gauge size={15} />} />
              <div className="px-5 py-1">
                <Field label="Leaving air">{d.leavingTempF}°F / {d.leavingGrains} gr/lb<Entered data={d} conditionKey="leaving" /></Field>
                <Field label="Process airflow">{d.processCfm ? `${d.processCfm} cfm` : '—'}</Field>
                <Field label="Air source">{d.airSource}{d.mixOutdoorPct ? ` — ${d.mixOutdoorPct}% OA` : ''}</Field>
                <Field label="Return / room air">{d.surroundTempF || '—'}°F / {d.surroundRhPct || '—'}% rh</Field>
                <Field label="Outdoor design">
                  {d.outdoorTempF || '—'}°F / {d.outdoorRhPct || '—'}% rh
                  <OutdoorSource data={d} />
                </Field>
                <Field label="Entering air (estimated)">{s.entering_grains != null ? `${s.entering_grains} gr/lb` : '—'}</Field>
              </div>
            </Card>
          )}

          <Card>
            <CardHead title="Equipment & utilities" icon={<Cog size={15} />} />
            <div className="px-5 py-1">
              <Field label="Install location">{d.installLocation}</Field>
              <Field label="Construction">{d.construction}</Field>
              <Field label="Electrical">{d.voltage}</Field>
              <Field label="Chilled water">{d.chilledWaterEwt ? `${d.chilledWaterEwt}°F EWT` : 'Not available'}</Field>
              <Field label="Hot water">{d.hotWaterEwt ? `${d.hotWaterEwt}°F EWT` : 'Not available'}</Field>
              <Field label="Steam">{d.steamPsi ? `${d.steamPsi} psi` : 'Not available'}</Field>
              <Field label="Regeneration heat">{d.regenSource}</Field>
              <Field label="Regeneration air">{d.regenAirSource}{d.regenIndoorConditions ? ` — ${d.regenIndoorConditions}` : ''}</Field>
              <Field label="Filtration">{d.prefilterMerv} / {d.finalMerv}</Field>
              <Field label="Cooling">{d.coolingType}</Field>
              <Field label="Heating">{d.heatingType}</Field>
              <Field label="Environment">{d.environmentClean}{d.contaminants ? ` — ${d.contaminants}` : ''}</Field>
              <Field label="Schedule">{d.runtime}</Field>
              <Field label="Size / weight limits">{d.sizeRestrictions || 'None stated'}</Field>
              <Field label="Sensible load">{d.sensibleLoadBtuh ? `${d.sensibleLoadBtuh} BTU/hr` : 'Not stated'}</Field>
            </div>
          </Card>

          {(d.purpose || d.notes) && (
            <Card>
              <CardHead title="In their words" icon={<User size={15} />} />
              <div className="space-y-3 px-5 py-4">
                {d.purpose && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">{d.purpose}</p>}
                {d.notes && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{d.notes}</p>}
              </div>
            </Card>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <TriageCard
            id={row.id}
            initialStatus={isRfqStatus(row.status) ? row.status : 'new'}
            initialAssigneeId={row.assignee_id ?? null}
            roster={roster}
            notes={notes ?? []}
          />

          <Card>
            <CardHead title="Who sent it" icon={<Building2 size={15} />} />
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              <MetaRow label="Company">{d.company || '—'}</MetaRow>
              <MetaRow label="Contact">{d.contactName || '—'}</MetaRow>
              <MetaRow label="Email">
                <a href={`mailto:${d.email}`} className="text-emerald-700 hover:underline dark:text-emerald-400">{d.email}</a>
              </MetaRow>
              <MetaRow label="Phone">{d.phone || '—'}</MetaRow>
              <MetaRow label="End user">{d.endUser || '—'}</MetaRow>
              <MetaRow label="Engineering firm">{d.engineeringFirm || '—'}</MetaRow>
              <MetaRow label="Engineer contact">{d.engineerContact || '—'}</MetaRow>
            </div>
          </Card>

          <Card>
            <CardHead title="The project" />
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              <MetaRow label="Reference">{row.reference}</MetaRow>
              <MetaRow label="Project">{d.projectName || '—'}</MetaRow>
              <MetaRow label="Application">{row.application_label}</MetaRow>
              <MetaRow label="Location">{d.location || '—'}</MetaRow>
              <MetaRow label="Quote needed">{d.dateRequired || '—'}</MetaRow>
              <MetaRow label="Expected order">{d.dateClose || '—'}</MetaRow>
              <MetaRow label="Received">
                {new Date(row.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </MetaRow>
            </div>
          </Card>
        </div>
      </div>
    </DetailShell>
  )
}

const BAR: Record<string, string> = {
  doors: 'bg-amber-500', infiltration: 'bg-sky-500', permeation: 'bg-teal-500',
  people: 'bg-violet-500', product: 'bg-emerald-500', gas: 'bg-rose-500', wet: 'bg-blue-600',
}

function Breakdown({ lines }: { lines: { key: string; label: string; gr_per_hr: number }[] }) {
  const total = lines.reduce((s, l) => s + l.gr_per_hr, 0) || 1
  return (
    <div className="space-y-2.5">
      {[...lines].sort((a, b) => b.gr_per_hr - a.gr_per_hr).map(l => (
        <div key={l.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px] text-zinc-600 dark:text-zinc-300">{l.label}</span>
            <span className="flex-shrink-0 text-[11.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
              {fmt(l.gr_per_hr)} gr/hr · {Math.round((l.gr_per_hr / total) * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-full rounded-full ${BAR[l.key] ?? 'bg-emerald-500'}`}
                 style={{ width: `${Math.max((l.gr_per_hr / total) * 100, 1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The reading as the customer typed it, shown only when they used something
 * other than the canonical unit. Answering in dew point or wet bulb is a signal
 * about how their spec is written, and that is worth seeing on the desk side.
 * Surveys taken before the unit selector shipped have no reading and show nothing.
 */
function Entered({ data, conditionKey }: { data: RfqData; conditionKey: ConditionKey }) {
  const entered = conditionEntered(data, conditionKey)
  const canonical = conditionKey === 'leaving' ? 'gr/lb' : '% rh'
  if (entered === '—' || entered.endsWith(canonical)) return null
  return (
    <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
      entered as {entered}
    </span>
  )
}

/**
 * Where the outdoor design condition came from.
 *
 * Rendered only when it was actually looked up. Silence means the figures are the
 * customer's own or the seeded default — and a quote priced against a template
 * default should not look identical to one priced against the site's real weather.
 */
function OutdoorSource({ data }: { data: RfqData }) {
  if (!data.outdoorSource) return null
  // The edition year is deliberately absent from the customer's wizard and PDF and
  // present here: staff are the ones who need it when a quote and a later check
  // disagree. Older records carry no vintage and simply do not show the second pill.
  return (
    <>
      <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
        {data.outdoorSource}
      </span>
      {data.outdoorVintage && (
        <span className="ml-1.5 rounded bg-surface-soft px-1.5 py-0.5 text-[11px] text-ink-muted">
          {data.outdoorVintage}
        </span>
      )}
    </>
  )
}

function num(v: string): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
