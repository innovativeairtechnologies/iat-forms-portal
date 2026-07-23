import Link from 'next/link'
import { timeAgo } from '@/components/admin/list'
import { Card, CardHead, T } from '@/components/dashboards/sales-charts'
import type { ExecData } from '@/lib/exec-dashboard-data'
import {
  Inbox, FileText, Ticket, CheckCircle2, AlertCircle, ShieldCheck, Sparkles, ArrowRight,
} from 'lucide-react'

/* Pure presentational cards for the admin EXECUTIVE dashboard, ported verbatim
   from the old inline app/admin/page.tsx widgets onto the shared sales-charts
   primitives + tokens. Each takes the shared ExecData slice it needs. Wrapped as
   admin-only registry cards in dept-cards.tsx (which threads ExecData via ctx). */

const C = { green: '#10b981', blue: '#3b82f6', violet: '#8b5cf6', amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9' }
const fmt = (n: number) => n.toLocaleString()

const PRIORITY_DOT: Record<string, string> = { high: C.rose, med: C.amber, low: C.sky }
const STATUS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: C.rose,  bg: 'rgba(244,63,94,0.12)' },
  in_progress: { label: 'In Progress', color: C.amber, bg: 'rgba(245,158,11,0.14)' },
  resolved:    { label: 'Resolved',    color: C.green, bg: 'rgba(16,185,129,0.14)' },
}

function auditColor(action: string): string {
  if (action.startsWith('form.delete') || action.startsWith('employee.deactivate')) return C.rose
  if (action.startsWith('form.pause')) return C.amber
  if (action.startsWith('form.')) return C.green
  if (action.startsWith('role.')) return C.violet
  if (action.startsWith('request.')) return C.amber
  if (action.startsWith('submission.')) return C.blue
  if (action.startsWith('ticket.')) return C.rose
  if (action.startsWith('accrual.')) return C.sky
  if (action.startsWith('employee.')) return C.green
  return T.inkFaint
}

// ── Shared small pieces ───────────────────────────────────────────────────────
function LineChart({ days, a, b, ca, cb }: {
  days: { label: string }[]; a: number[]; b?: number[]; ca: string; cb?: string
}) {
  const W = 620, H = 190, padL = 30, padR = 12, padT = 14, padB = 26
  const iw = W - padL - padR, ih = H - padT - padB
  const max = Math.max(2, ...a, ...(b ?? []))
  const n = a.length
  const x = (i: number) => padL + (iw * i) / (n - 1)
  const y = (v: number) => padT + ih * (1 - v / max)
  const line = (d: number[]) => d.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (d: number[]) => `${line(d)} L${x(n - 1).toFixed(1)},${(padT + ih).toFixed(1)} L${padL.toFixed(1)},${(padT + ih).toFixed(1)} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1]
  const ticks = [0, 4, 8, 11, 13]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="egradA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ca} stopOpacity="0.26" />
          <stop offset="100%" stopColor={ca} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="egradB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cb} stopOpacity="0.18" />
          <stop offset="100%" stopColor={cb} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => {
        const gy = padT + ih * g
        return (
          <g key={i}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={T.hair} strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fill={T.inkFaint} fontSize="9">{Math.round(max * (1 - g))}</text>
          </g>
        )
      })}
      <path d={area(a)} fill="url(#egradA)" />
      {b && <path d={area(b)} fill="url(#egradB)" />}
      {b && cb && <path d={line(b)} fill="none" stroke={cb} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />}
      <path d={line(a)} fill="none" stroke={ca} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {a.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3 : 0} fill={ca} />)}
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fill={T.inkFaint} fontSize="9">{days[t]?.label}</text>
      ))}
    </svg>
  )
}

function LegendInline({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function RankRow({ rank, label, value, pct: barPct, color }: { rank: number; label: string; value: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-ink-faint w-3 tabular-nums">{rank}</span>
      <span className="text-[12px] text-ink-secondary truncate flex-1 min-w-0">{label}</span>
      <div className="w-28 h-1.5 rounded-full bg-surface-strong overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold text-ink tabular-nums w-10 text-right">{fmt(value)}</span>
    </div>
  )
}

function AttentionRow({ icon, color, label, value, href }: { icon: React.ReactNode; color: string; label: string; value: number; href: string }) {
  const has = value > 0
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-soft transition-colors group">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}1f`, color }}>{icon}</span>
      <span className="flex-1 text-[12px] font-medium text-ink-secondary group-hover:text-ink transition-colors">{label}</span>
      <span className="text-[14px] font-semibold tabular-nums" style={{ color: has ? color : undefined }}>
        <span className={has ? '' : 'text-ink-faint'}>{value}</span>
      </span>
      <ArrowRight size={13} className="text-ink-faint group-hover:text-ink-muted transition-colors" />
    </Link>
  )
}

// ── The exec cards ────────────────────────────────────────────────────────────
export function FormsPerformanceCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Forms Performance" icon={<FileText size={13} />} iconTone="sky" action="View all" href="/admin/forms" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-5">Form</div>
        <div className="col-span-1 text-right">Subs</div>
        <div className="col-span-1 text-right">7d</div>
        <div className="col-span-1 text-right">Unread</div>
        <div className="col-span-2">Share</div>
        <div className="col-span-2 text-right">Last activity</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.formRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No submissions yet</div>
        ) : (
          d.formRows.slice(0, 7).map((f) => {
            const active = d.activeTitles.has(f.title)
            return (
              <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
                <div className="col-span-5 flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: active ? C.green : T.inkFaint }} />
                  <span className="font-medium text-ink truncate">{f.title}</span>
                </div>
                <div className="col-span-1 text-right tabular-nums text-ink-secondary">{fmt(f.count)}</div>
                <div className="col-span-1 text-right tabular-nums text-ink-muted">{f.week}</div>
                <div className="col-span-1 text-right tabular-nums">
                  {f.unread > 0 ? <span className="text-amber-600 dark:text-amber-400">{f.unread}</span> : <span className="text-ink-faint">0</span>}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(f.count / d.maxFormCount) * 100}%`, backgroundColor: C.sky }} />
                  </div>
                </div>
                <div className="col-span-2 text-right text-ink-muted tabular-nums">{timeAgo(f.last)}</div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

export function TopFormsCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Top Forms by Volume" icon={<FileText size={13} />} iconTone="emerald" />
      <div className="px-5 py-4 space-y-3">
        {d.formRows.slice(0, 5).map((f, i) => (
          <RankRow key={f.title} rank={i + 1} label={f.title} value={f.count} pct={(f.count / d.maxFormCount) * 100} color={T.brand} />
        ))}
        {d.formRows.length === 0 && <p className="text-[13px] text-ink-muted py-4 text-center">No data yet</p>}
      </div>
    </Card>
  )
}

export function TopSubmittersCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Top Submitters" icon={<Inbox size={13} />} iconTone="violet" action="People" href="/admin/employees" />
      <div className="px-5 py-4 space-y-3">
        {d.people.slice(0, 5).map((p, i) => (
          <RankRow key={p.name + i} rank={i + 1} label={p.name} value={p.count} pct={(p.count / d.maxPeople) * 100} color={T.brand} />
        ))}
        {d.people.length === 0 && <p className="text-[13px] text-ink-muted py-4 text-center">No data yet</p>}
      </div>
    </Card>
  )
}

export function ActivityCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-hairline-soft">
        <h3 className="text-[12px] font-semibold text-ink tracking-[-0.006em] truncate">Activity · Last 14 days</h3>
        <div className="ml-auto flex items-center gap-4">
          <LegendInline color={C.green} label="Submissions" />
          <LegendInline color={C.rose} label="Tickets" />
        </div>
      </div>
      <div className="px-3 py-4">
        <LineChart days={d.days} a={d.subSeries} b={d.tktSeries} ca={C.green} cb={C.rose} />
      </div>
    </Card>
  )
}

export function FormStatusCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Form Status" icon={<FileText size={13} />} iconTone="slate" action="Manage" href="/admin/forms" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-6">Form</div>
        <div className="col-span-2 text-right">Subs</div>
        <div className="col-span-2">State</div>
        <div className="col-span-2 text-right">Last</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.formStatus.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No forms yet</div>
        ) : (
          d.formStatus.slice(0, 6).map((f) => (
            <div key={f.title} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
              <div className="col-span-6 font-medium text-ink truncate">{f.title}</div>
              <div className="col-span-2 text-right tabular-nums text-ink-secondary">{fmt(f.count)}</div>
              <div className="col-span-2">
                {f.active ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: C.green }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.green }} /> Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.inkFaint }} /> Draft
                  </span>
                )}
              </div>
              <div className="col-span-2 text-right text-ink-muted tabular-nums">{f.last ? timeAgo(f.last) : '—'}</div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

export function RecentTicketsCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Recent Tickets" icon={<Ticket size={13} />} iconTone="rose" action="View all" href="/admin/tickets" />
      <div className="px-5 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted border-b border-hairline-soft">
        <div className="col-span-4">Customer</div>
        <div className="col-span-3">Equipment</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">Age</div>
      </div>
      <div className="divide-y divide-hairline-soft">
        {d.recentTickets.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-muted">No tickets yet</div>
        ) : (
          d.recentTickets.map((t) => {
            const sp = STATUS_PILL[t.status] || STATUS_PILL.open
            return (
              <Link key={t.id} href={`/admin/tickets/${t.id}`} className="px-5 py-3 grid grid-cols-12 gap-2 items-center text-[12px] hover:bg-surface-soft transition-colors">
                <div className="col-span-4 min-w-0">
                  <p className="font-medium text-ink truncate">{t.customer_name}</p>
                  <p className="text-[10px] text-ink-muted truncate">{t.ticket_number}</p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-ink-secondary truncate">{t.model_number || '—'}</p>
                  <p className="text-[10px] text-ink-faint truncate">{t.serial_number ? `S/N ${t.serial_number}` : ''}</p>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary capitalize">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_DOT[t.priority ?? 'med'] || C.amber }} />
                    {t.priority ?? 'med'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sp.color, backgroundColor: sp.bg }}>{sp.label}</span>
                </div>
                <div className="col-span-1 text-right text-ink-muted tabular-nums">{timeAgo(t.created_at)}</div>
              </Link>
            )
          })
        )}
      </div>
    </Card>
  )
}

export function NeedsAttentionCard({ d }: { d: ExecData }) {
  const attentionCount = d.attention.unread + d.attention.openTickets + d.attention.pendingApprovals
  return (
    <Card className="h-full">
      <CardHead title="Needs Attention" icon={<AlertCircle size={13} />} iconTone="amber" />
      <div className="p-2">
        <AttentionRow icon={<Inbox size={15} />} color={C.amber} label="Unread submissions" value={d.attention.unread} href="/admin/submissions?is_read=false" />
        <AttentionRow icon={<Ticket size={15} />} color={C.rose} label="Open tickets" value={d.attention.openTickets} href="/admin/tickets" />
        <AttentionRow icon={<ShieldCheck size={15} />} color={C.violet} label="Forms pending approval" value={d.attention.pendingApprovals} href="/admin/forms" />
      </div>
      {attentionCount === 0 && (
        <div className="px-5 pb-4 -mt-1">
          <div className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> All clear — you&apos;re caught up.
          </div>
        </div>
      )}
    </Card>
  )
}

export function LiveActivityCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Live Activity" icon={<Sparkles size={13} />} iconTone="emerald" />
      <div className="px-5 py-4">
        {d.activity.length === 0 ? (
          <p className="text-[12px] text-ink-muted text-center py-4">No recent activity</p>
        ) : (
          <ol className="relative space-y-3.5">
            <span className="absolute left-[11px] top-1 bottom-1 w-px bg-hairline" aria-hidden />
            {d.activity.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                <Link href={e.href} className="group flex gap-3 items-start">
                  <span className="relative z-10 mt-0.5 w-[23px] h-[23px] rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-surface"
                    style={{ backgroundColor: e.kind === 'sub' ? 'rgba(16,185,129,0.14)' : 'rgba(244,63,94,0.14)', color: e.kind === 'sub' ? C.green : C.rose }}>
                    {e.kind === 'sub' ? <Inbox size={12} /> : <Ticket size={12} />}
                  </span>
                  <div className="flex-1 min-w-0 -mt-px">
                    <p className="text-[12px] text-ink-secondary leading-snug">
                      <span className="font-semibold text-ink group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{e.name}</span>
                      {e.kind === 'sub' ? ' submitted ' : ' opened '}
                      <span className="text-ink-muted">{e.label}</span>
                    </p>
                    <p className="text-[10px] text-ink-faint tabular-nums mt-0.5">{timeAgo(e.time)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

export function AdminActivityCard({ d }: { d: ExecData }) {
  return (
    <Card className="h-full">
      <CardHead title="Admin Activity" icon={<ShieldCheck size={13} />} iconTone="slate" action="Full log" href="/admin/audit" />
      <div className="px-5 py-4">
        {d.recentAudit.length === 0 ? (
          <p className="text-[12px] text-ink-muted text-center py-3">No admin actions logged yet</p>
        ) : (
          <ul className="space-y-3">
            {d.recentAudit.map((a) => (
              <li key={a.id} className="flex gap-2.5 items-start">
                <span className="mt-[5px] w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: auditColor(a.action) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-ink-secondary leading-snug line-clamp-2">{a.summary}</p>
                  <p className="text-[10px] text-ink-faint tabular-nums mt-0.5">{a.actor_name || 'Unknown'} · {timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
