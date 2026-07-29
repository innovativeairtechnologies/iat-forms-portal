'use client'

/* ────────────────────────────────────────────────────────────────────────────
   Drawer — the floating right-side record panel.

   The house pattern for "click a row/card → see the whole record" across the
   portal (deals board, territories reps, and anything that follows). It is a
   modal by behavior (scrim, Esc, focus containment) but a *drawer* by geometry:
   inset from all four edges so it reads as floating over the page rather than
   welded to the viewport edge — the context behind it stays legible, which is
   the entire point of choosing this over a centre modal.

   PORTALS TO document.body — do not "simplify" this to an inline render.
   `position: fixed` sets the drawer's geometry against the viewport, but it does
   NOT escape an ancestor **stacking context**. `RepPanel` lives inside
   `<aside className="… z-20">` on /admin/territories; rendered inline, the whole
   z-50 drawer was painted as one z-20 unit and the map column's `z-30` controls
   (the panel-toggle button, the mode toolbars) sat *on top of* the panel, outside
   the scrim and still clickable — clicking the toggle unmounted the drawer.
   Verified in Chromium via elementFromPoint at 390/700/1024/1440/1920px.

   Elevation follows DESIGN.md §5: Level 3 shadow in light, and in dark **no
   shadow at all** — a `ring-1 ring-white/10` does the lifting. The shadow is a
   Tailwind arbitrary value (not an inline style) precisely so `dark:shadow-none`
   can win; an inline `style={{boxShadow}}` would out-specify it and leak a
   light-mode shadow into dark.

   Scrim note: DESIGN.md §6 specs `bg-black/40` for centre modals. A drawer
   deliberately runs lighter (`bg-black/25`) — at 40% the board behind is dimmed
   to the point that the "floating over your work" read is lost, which is the
   one thing this component exists to deliver.
   ──────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const PANEL_SHADOW =
  'shadow-[0_8px_24px_rgba(31,30,27,.10),0_2px_6px_rgba(31,30,27,.05)] dark:shadow-none dark:ring-1 dark:ring-white/10'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Drawer({
  onClose,
  dismissable = true,
  width = 480,
  labelledBy,
  children,
}: {
  onClose: () => void
  /** False while an inner form is dirty — suppresses scrim-click + Esc close. */
  dismissable?: boolean
  /** Panel width in px; clamped to the viewport on small screens. */
  width?: number
  labelledBy?: string
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Esc closes. Registered here (not in the consumer) so every drawer in the
  // portal behaves the same; consumers that need Esc to cancel an inner edit
  // first should pass dismissable={false} while that edit is open.
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissable, onClose])

  // Lock body scroll while open — otherwise the page behind scrolls under the
  // drawer when the pointer leaves the panel.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Focus management — `aria-modal` is a promise to assistive tech that the rest
  // of the page is inert, so honour it: pull focus in on open, contain Tab, and
  // hand focus back to whatever opened the drawer on close.
  useEffect(() => {
    if (!mounted) return
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((n) => n.offsetParent !== null || n === document.activeElement)
      if (nodes.length === 0) { e.preventDefault(); return }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === firstNode || !panelRef.current.contains(active))) {
        e.preventDefault(); lastNode.focus()
      } else if (!e.shiftKey && active === lastNode) {
        e.preventDefault(); firstNode.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.({ preventScroll: true })
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onMouseDown={dismissable ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px] animate-scrim-in motion-reduce:animate-none" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, calc(100vw - 1.5rem))` }}
        className={`absolute top-3 right-3 bottom-3 sm:top-4 sm:right-4 sm:bottom-4 flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface outline-none animate-drawer-in motion-reduce:animate-none ${PANEL_SHADOW}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Pinned identity block. Stays put while the active tab scrolls beneath it. */
export function DrawerHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 border-b border-hairline-soft px-5 py-4">
      {children}
    </div>
  )
}

/** The one scrolling region — a tab's content, never the whole record. */
export function DrawerBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
}

/** Pinned action bar. Primary action right, destructive left. */
export function DrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 border-t border-hairline-soft px-5 py-3 flex items-center justify-between gap-2">
      {children}
    </div>
  )
}
