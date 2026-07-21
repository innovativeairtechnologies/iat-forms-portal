'use client'

import { useMemo, useRef, useState } from 'react'
import { Building2, Check } from 'lucide-react'
import type { Company } from '@/lib/supabase'
import { normalizeCompany } from '@/lib/crm-normalize'
import { inp } from './form'

/* Company picker used by the New Deal modal and the deal detail's Company
   section. Controlled: the parent owns (text, companyId); picking a company
   emits its id + display name, free typing emits (null, text) — the server
   then exact-matches or auto-creates on save, so "no selection" is never an
   error state. */

export default function CompanyCombobox({
  companies, text, companyId, onChange, placeholder, autoFocus,
}: {
  companies: Company[]
  text: string
  companyId: string | null
  onChange: (companyId: string | null, text: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = text.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q) return companies.slice(0, 8)
    return companies.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [companies, q])

  // Would free text land on an existing company at save time?
  const exact = useMemo(() => {
    if (!q) return null
    const norm = normalizeCompany(text).normalized
    return companies.find((c) => c.normalized_name === norm) ?? null
  }, [companies, text, q])

  const picked = companyId ? companies.find((c) => c.id === companyId) ?? null : null

  return (
    <div className="relative">
      <input
        className={inp}
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Company or client name'}
        onChange={(e) => { onChange(null, e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
      />
      {open && (matches.length > 0 || q) && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-hairline bg-surface overflow-hidden"
          style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
              onClick={() => { onChange(c.id, c.name); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-soft transition-colors border-t border-hairline-soft first:border-t-0"
            >
              <Building2 size={13} className="text-ink-faint flex-shrink-0" />
              <span className="text-[12.5px] text-ink truncate flex-1">{c.name}</span>
              {c.id === companyId && <Check size={13} className="text-ink-faint flex-shrink-0" />}
            </button>
          ))}
          {q && !picked && (
            <p className="px-3 py-1.5 text-[10.5px] text-ink-faint border-t border-hairline-soft bg-surface-soft">
              {exact
                ? `Will link to existing "${exact.name}"`
                : 'No match — a new company will be created'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
