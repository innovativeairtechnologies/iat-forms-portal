'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, Mail, Phone, Users } from 'lucide-react'
import { Card, CardHead } from '@/components/dashboards/sales-charts'
import type { DirectoryPerson } from '@/lib/directory'

/* ────────────────────────────────────────────────────────────────────────────
   Company Directory — the dashboard card, and the same list reused on the
   profile page.

   A client component because the whole point is type-to-filter: the roster is
   small enough (the whole company) that shipping it once and filtering in the
   browser beats a round trip per keystroke. It receives already-shaped rows
   from lib/directory.ts, so it holds no query and no auth logic.
   ──────────────────────────────────────────────────────────────────────────── */

function Avatar({ person }: { person: DirectoryPerson }) {
  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-hairline"
      />
    )
  }
  return (
    <span className="w-7 h-7 rounded-full bg-surface-strong text-ink-secondary flex items-center justify-center text-[10px] font-semibold flex-shrink-0 select-none">
      {person.initials}
    </span>
  )
}

function Row({ person }: { person: DirectoryPerson }) {
  const sub = [person.jobTitle, person.department].filter(Boolean).join(' · ')
  return (
    <li className="flex items-center gap-2.5 px-4 py-2 border-b border-hairline-soft last:border-b-0 hover:bg-surface-soft transition-colors">
      <Avatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-ink truncate leading-tight">{person.name}</p>
        {sub && <p className="text-[11px] text-ink-muted truncate leading-tight mt-0.5">{sub}</p>}
      </div>
      {/* Contact actions stay visible rather than hover-only — this card exists
          to be used from a phone, where there is no hover. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {person.phone && (
          <a
            href={`tel:${person.phone.replace(/[^\d+]/g, '')}`}
            title={person.phone}
            aria-label={`Call ${person.name}`}
            className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-strong transition-colors"
          >
            <Phone size={13} />
          </a>
        )}
        {person.email && (
          <a
            href={`mailto:${person.email}`}
            title={person.email}
            aria-label={`Email ${person.name}`}
            className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-strong transition-colors"
          >
            <Mail size={13} />
          </a>
        )}
      </div>
    </li>
  )
}

/** The searchable roster itself — no card chrome, so the profile page can embed it. */
export function DirectoryList({
  people,
  emptyHint = 'Nobody on the roster yet.',
}: {
  people: DirectoryPerson[]
  emptyHint?: string
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((p) =>
      [p.name, p.jobTitle, p.department, p.email, p.phone, p.managerName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  }, [people, query])

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-2.5 border-b border-hairline-soft flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          {/* Focus ring uses `ring-focus`. An opacity modifier on a semantic
              token (`ring-brand/15`) generates no rule — see tailwind.config.ts. */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search the company directory"
            className="w-full h-8 pl-8 pr-2.5 text-[12.5px] rounded-lg border border-hairline bg-surface text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-focus transition-colors"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-ink-muted text-center">
          {query.trim() ? `No one matches “${query.trim()}”.` : emptyHint}
        </p>
      ) : (
        <ul className="overflow-y-auto min-h-0 flex-1">
          {filtered.map((p) => (
            <Row key={p.id} person={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DirectoryCard({
  people,
  href = '/admin/me/directory',
}: {
  people: DirectoryPerson[]
  href?: string
}) {
  return (
    <Card className="h-full">
      <CardHead
        title="Company Directory"
        hint={`${people.length} ${people.length === 1 ? 'person' : 'people'}`}
        icon={<Users size={13} />}
        iconTone="sky"
        action="Open"
        href={href}
      />
      <DirectoryList people={people} />
      <Link
        href={href}
        className="flex-shrink-0 px-4 py-2 border-t border-hairline-soft text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
      >
        View full directory &amp; org chart →
      </Link>
    </Card>
  )
}
