'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { crumbsFor, type Crumb } from './crumbs'

/* ────────────────────────────────────────────────────────────────────────────
   PageChrome — lets a detail/editor page feed its record name + action buttons
   UP into the single shared AdminTopBar, instead of rendering a second stacked
   breadcrumb bar of its own.

   • Desktop: the record crumb is appended to AdminTopBar's derived trail (via
     context → `usePageChromeTail`), and the action buttons are portaled into
     AdminTopBar's actions slot (#admin-topbar-actions). Result is ONE bar:
     "Operations › Equipment › 26-5875   [Delete] [Save]".

   • Mobile: AdminTopBar is hidden (the sidebar's own fixed bar is the top
     chrome), so PageChrome renders a familiar sticky bar itself — list crumb +
     record + actions — matching the old DetailTopBar so mobile is unchanged.

   Usage:  <PageChrome record={equipment.serial_number}>{actions}</PageChrome>
   `record` may be a string (one trailing crumb) or a Crumb[] (several, e.g. a
   project nested under a department).
   ──────────────────────────────────────────────────────────────────────────── */

type Ctx = { tail: Crumb[] | null; setTail: (c: Crumb[] | null) => void }
const PageChromeCtx = createContext<Ctx>({ tail: null, setTail: () => {} })

/** Wraps AdminTopBar + the page in app/admin/layout.tsx so the two can talk. */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [tail, setTail] = useState<Crumb[] | null>(null)
  return <PageChromeCtx.Provider value={{ tail, setTail }}>{children}</PageChromeCtx.Provider>
}

/** AdminTopBar reads this to append the current page's record crumb(s). */
export function usePageChromeTail() {
  return useContext(PageChromeCtx).tail
}

function toCrumbs(record?: string | Crumb[]): Crumb[] {
  if (!record) return []
  return typeof record === 'string' ? [{ label: record }] : record
}

export default function PageChrome({ record, children }: { record?: string | Crumb[]; children?: ReactNode }) {
  const { setTail } = useContext(PageChromeCtx)
  const pathname = usePathname()
  const tail = toCrumbs(record)
  // Stable dependency: only re-register when the record labels/hrefs change, not
  // on every render — otherwise the provider would re-render in a loop.
  const key = JSON.stringify(tail)

  useEffect(() => {
    setTail(tail.length ? tail : null)
    return () => setTail(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setTail])

  // The desktop actions slot lives inside AdminTopBar (hidden below md), so
  // anything portaled here only shows on desktop. Resolved after mount because
  // the layout renders AdminTopBar before this descendant commits.
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setSlot(document.getElementById('admin-topbar-actions')) }, [])

  // Mobile trail = the page's list crumb (from the shared route map) + the
  // record, so the mobile bar reads "Equipment › 26-5875" like the old bar.
  const derived = crumbsFor(pathname)
  const listCrumb = derived[derived.length - 1]
  const mobileTrail: Crumb[] = [...(listCrumb ? [listCrumb] : []), ...tail]

  return (
    <>
      {slot && children ? createPortal(children, slot) : null}

      <div className="md:hidden sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 h-14 px-4 border-b border-hairline bg-canvas">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {mobileTrail.map((c, i) => {
            const last = i === mobileTrail.length - 1
            return (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <ChevronRight size={13} className="flex-shrink-0 text-ink-faint" />}
                {c.href && !last ? (
                  <Link href={c.href} className="flex-shrink-0 text-ink-muted hover:text-ink transition-colors">{c.label}</Link>
                ) : (
                  <span className={last ? 'truncate font-semibold text-ink' : 'flex-shrink-0 text-ink-muted'}>{c.label}</span>
                )}
              </span>
            )
          })}
        </div>
        {children ? (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
          </>
        ) : null}
      </div>
    </>
  )
}
