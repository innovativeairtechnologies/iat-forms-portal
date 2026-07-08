'use client'

// ─────────────────────────────────────────────────────────────────────────────
// "View as [role]" — an ADMIN-ONLY nav preview. It re-renders the sidebar as a
// given role would see it, WITHOUT changing the admin's real access. It is a
// pure client-side display override: it never touches the session, cookies, or
// middleware, so there is zero risk of locking the admin out. A hard refresh
// resets to the real role.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X, ChevronDown } from 'lucide-react'
import { ROLE_LABELS, STAFF_ROLES, hasPermission, homeForRole, type Role, type StaffRole, type Perm, type PermMatrix } from '@/lib/roles'

type ViewAsCtx = {
  realRole: Role
  /** the role being previewed, or null when not previewing */
  viewAs: StaffRole | null
  /** the role the sidebar should render for (viewAs ?? realRole) */
  effectiveRole: Role
  setViewAs: (r: StaffRole | null) => void
  /** only a full admin may preview */
  canPreview: boolean
  /** perm check for the effective role against the live DB-backed matrix */
  hasPerm: (perm: Perm) => boolean
  /** landing href for the effective role (matrix-aware) */
  home: string
}

const Ctx = createContext<ViewAsCtx | null>(null)

// `permMatrix` is the DB-backed role→perm matrix, fetched server-side in the
// admin layout and passed down so nav visibility (and "View as" previews)
// reflect live permission toggles rather than the static code defaults.
export function ViewAsProvider({ realRole, permMatrix, children }: { realRole: Role; permMatrix?: PermMatrix; children: ReactNode }) {
  const [viewAs, setViewAs] = useState<StaffRole | null>(null)
  const canPreview = realRole === 'admin'
  const effectiveRole: Role = canPreview && viewAs ? viewAs : realRole
  const hasPerm = (perm: Perm) => hasPermission(effectiveRole, perm, permMatrix)
  const home = homeForRole(effectiveRole, permMatrix)
  return (
    <Ctx.Provider value={{ realRole, viewAs, effectiveRole, setViewAs, canPreview, hasPerm, home }}>
      {children}
    </Ctx.Provider>
  )
}

export function useViewAs(): ViewAsCtx {
  const ctx = useContext(Ctx)
  // Fallback keeps the sidebar usable if ever rendered outside a provider.
  if (!ctx) {
    return {
      realRole: 'admin',
      viewAs: null,
      effectiveRole: 'admin',
      setViewAs: () => {},
      canPreview: false,
      hasPerm: () => true,
      home: '/admin',
    }
  }
  return ctx
}

// Roles selectable in the preview dropdown (everything the admin can impersonate
// for nav purposes — all staff roles except staying as themselves is "Exit").
const PREVIEW_ROLES: StaffRole[] = STAFF_ROLES.filter((r) => r !== 'admin')

/** Compact dropdown that lives in the sidebar. Only rendered for full admins. */
export function ViewAsControl() {
  const { canPreview, viewAs, setViewAs } = useViewAs()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null)

  // The sidebar's <aside> is `overflow-hidden` (for its rounded/sticky layout),
  // which clips an absolutely-positioned dropdown after just 2-3 rows — it's
  // being cut by the sidebar's own box, not missing a scrollbar. Portaling to
  // <body> with fixed positioning (measured from the button) escapes that
  // clipping entirely, regardless of viewport height or sidebar scroll state.
  useEffect(() => {
    if (!open) return
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setPos({ left: r.left, bottom: window.innerHeight - r.top + 4, width: r.width })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open])

  if (!canPreview) return null

  return (
    <div className="relative px-3 mt-2">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all ${
          viewAs
            ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
            : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
        }`}
      >
        <Eye size={14} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {viewAs ? `Viewing as ${ROLE_LABELS[viewAs]}` : 'View as…'}
        </span>
        <ChevronDown size={13} className="flex-shrink-0 opacity-60" />
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
          >
            {viewAs && (
              <button
                onClick={() => { setViewAs(null); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              >
                <X size={12} /> Exit preview (back to Admin)
              </button>
            )}
            {PREVIEW_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => { setViewAs(r); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                  viewAs === r
                    ? 'font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

/** Sticky banner shown at the top of the content area while previewing. */
export function ViewAsBanner() {
  const { viewAs, setViewAs, canPreview } = useViewAs()
  if (!canPreview || !viewAs) return null
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-3 px-4 py-2 bg-amber-500 text-white text-[12.5px] font-medium shadow-sm">
      <Eye size={14} />
      <span>
        Previewing the portal as <strong>{ROLE_LABELS[viewAs]}</strong>. Your own access is unchanged.
      </span>
      <button
        onClick={() => setViewAs(null)}
        className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
      >
        <X size={12} /> Exit
      </button>
    </div>
  )
}
