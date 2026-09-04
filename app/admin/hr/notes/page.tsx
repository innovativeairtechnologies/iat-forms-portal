import { supabaseAdmin } from '@/lib/supabase-admin'
import { prettyName } from '@/lib/display-name'
import PageChrome from '@/app/admin/PageChrome'
import { MessageSquare, Calendar, Clock, LogOut } from 'lucide-react'

export const dynamic = 'force-dynamic'

type NoteEntry = {
  id: string
  kind: 'pto' | 'sick' | 'clock_out'
  name: string
  at: string
  note: string
}

const KIND_META: Record<NoteEntry['kind'], { label: string; icon: React.ReactNode; cls: string }> = {
  pto:       { label: 'PTO request',    icon: <Calendar size={12} />, cls: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800' },
  sick:      { label: 'Sick request',   icon: <Clock size={12} />,    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  clock_out: { label: 'Clock-out note', icon: <LogOut size={12} />,   cls: 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
}

export default async function HrNotesPage() {
  const [{ data: requests }, { data: shifts }, { data: emps }] = await Promise.all([
    supabaseAdmin
      .from('time_off_requests')
      .select('id, type, notes, created_at, employee_id')
      .not('notes', 'is', null)
      .neq('notes', '')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('time_shifts')
      .select('id, notes, ended_at, employee_id')
      .not('notes', 'is', null)
      .neq('notes', '')
      .order('ended_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('employees')
      .select('id, name'),
  ])

  const nameOf = (id: string) => prettyName((emps ?? []).find(e => e.id === id)?.name ?? 'Unknown')

  const entries: NoteEntry[] = [
    ...(requests ?? []).map(r => ({
      id: r.id,
      kind: (r.type === 'pto' ? 'pto' : 'sick') as NoteEntry['kind'],
      name: nameOf(r.employee_id),
      at: r.created_at,
      note: r.notes as string,
    })),
    ...(shifts ?? []).filter(s => s.ended_at).map(s => ({
      id: s.id,
      kind: 'clock_out' as const,
      name: nameOf(s.employee_id),
      at: s.ended_at as string,
      note: s.notes as string,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <PageChrome record="Notes" />

      <div className="mt-1 rounded-xl border border-hairline bg-surface">
        <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <MessageSquare size={14} className="text-ink-faint" />
          <h1 className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            All employee notes
          </h1>
          <span className="ml-auto text-[12px] text-ink-faint">{entries.length}</span>
        </header>

        {entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-ink-muted">No notes yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {entries.map(e => {
              const meta = KIND_META[e.kind]
              return (
                <li key={e.kind + e.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{e.name}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
                        {meta.icon}{meta.label}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums text-[12px] text-ink-faint">
                      {new Date(e.at).toLocaleString('en-US', {
                        timeZone: 'America/New_York',
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-ink-secondary">{e.note}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
