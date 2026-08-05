'use client'

/* Add one person to a compensation review.

   Two ways in, because the roster genuinely has two kinds of people: staff with
   a portal account (picked from the list, so tenure comes from their hire date
   and the line is linked), and everyone else (typed by hand — the source
   workbook listed two people by first name only, and employees.id is FK'd to
   auth.users, so an unlinked line is a first-class row rather than a workaround). */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, Search, UserPlus, X } from 'lucide-react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/Drawer'
import { ToneAvatar } from '@/components/admin/list-card'
import { tenureFrom, type CompReviewLine } from '@/lib/comp-review'
import { send, type RosterPerson } from './CompReviewClient'

const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'

export default function AddPersonDialog({
  cycleId, roster, taken, onClose, onAdded,
}: {
  cycleId: string
  roster: RosterPerson[]
  /** employee_ids already on this review — offered, but disabled. */
  taken: Set<string>
  onClose: () => void
  onAdded: (line: CompReviewLine) => void
}) {
  const [search, setSearch] = useState('')
  const [manualName, setManualName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return roster
    return roster.filter((p) =>
      [p.name, p.jobTitle, p.department].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [roster, search])

  const add = async (body: Record<string, unknown>, key: string) => {
    setBusyId(key); setError(null)
    try {
      const res = await send('/api/admin/comp-review/lines', 'POST', { cycleId, ...body })
      onAdded(res.line as CompReviewLine)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add them.')
      setBusyId(null)
    }
  }

  return (
    <Drawer onClose={onClose} dismissable={!busyId} width={480} labelledBy="add-person-title">
      <DrawerHeader>
        <div className="flex items-center justify-between gap-3">
          <h2 id="add-person-title" className="text-[15px] font-semibold text-ink">Add to the review</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </DrawerHeader>

      <DrawerBody>
        <label className="relative block mb-3">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff…"
            className="w-full h-9 pl-8 pr-2.5 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
          />
        </label>

        <div className="rounded-lg border border-hairline divide-y divide-[color:var(--hairline-soft)]">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-ink-muted">No staff match that.</p>
          ) : (
            matches.map((p) => {
              const already = taken.has(p.id)
              const tenure = tenureFrom(p.hireDate)
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={already || busyId !== null}
                  onClick={() => add({ employee_id: p.id, person_name: p.name }, p.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-soft transition-colors disabled:opacity-45 disabled:hover:bg-transparent"
                >
                  <ToneAvatar name={p.name} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink truncate">{p.name}</span>
                    <span className="block text-[11.5px] text-ink-muted truncate">
                      {[p.jobTitle, p.department, tenure].filter(Boolean).join(' · ') || 'No details on file'}
                    </span>
                  </span>
                  {already
                    ? <span className="text-[11px] text-ink-faint flex-shrink-0">On review</span>
                    : busyId === p.id
                      ? <Loader2 size={15} className="animate-spin text-ink-muted flex-shrink-0" />
                      : <UserPlus size={15} className="text-ink-faint flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-hairline-soft">
          <p className="text-[12px] font-medium text-ink-secondary mb-1.5">Someone without a portal account</p>
          <div className="flex gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Full name"
              className="flex-1 h-9 px-2.5 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors"
            />
            <button
              type="button"
              disabled={!manualName.trim() || busyId !== null}
              onClick={() => add({ person_name: manualName.trim() }, '__manual')}
              className={BTN_QUIET}
            >
              {busyId === '__manual' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Add
            </button>
          </div>
          <p className="text-[11px] text-ink-faint mt-1.5">
            Their tenure will need to be entered by hand — there's no hire date to read.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-[12.5px] text-rose-500 flex items-start gap-1.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}
      </DrawerBody>

      <DrawerFooter>
        <span />
        <button type="button" onClick={onClose} className={BTN_QUIET}>Done</button>
      </DrawerFooter>
    </Drawer>
  )
}
