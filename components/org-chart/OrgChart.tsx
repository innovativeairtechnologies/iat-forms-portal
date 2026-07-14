'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Network, Search, Eraser, Pencil, Eye, EyeOff, ZoomIn, ZoomOut, Maximize2,
  X, Users, Mail, Phone, Calendar, Building2, CornerDownRight, Plus,
  GripVertical, Check, ChevronDown, UserCog,
} from 'lucide-react'
import { setManager, setVisibility, setInterests } from '@/app/admin/org-chart/actions'

// ─── Types ──────────────────────────────────────────────────────────────────

export type OrgEmployee = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  job_title: string | null
  department: string | null
  phone: string | null
  bio: string | null
  hire_date: string | null
  manager_id: string | null
  interests: string[]
  org_visible: boolean
  org_sort: number | null
}

type XY = { x: number; y: number }
type Transform = { tx: number; ty: number; s: number }

// ─── Geometry ───────────────────────────────────────────────────────────────

const NODE_W = 200
const NODE_H = 96
const SLOT = 228
const LEVEL_H = 168

// ─── Department palette (stable hash → tasteful ramp; readable in both modes) ──

const PALETTES = [
  { bar: '#10b981', chipBg: '#ecfdf5', chipText: '#047857', avBg: '#d1fae5', avText: '#065f46', line: '#34d399' },
  { bar: '#0ea5e9', chipBg: '#f0f9ff', chipText: '#0369a1', avBg: '#e0f2fe', avText: '#075985', line: '#38bdf8' },
  { bar: '#8b5cf6', chipBg: '#f5f3ff', chipText: '#6d28d9', avBg: '#ede9fe', avText: '#5b21b6', line: '#a78bfa' },
  { bar: '#f59e0b', chipBg: '#fffbeb', chipText: '#b45309', avBg: '#fef3c7', avText: '#92400e', line: '#fbbf24' },
  { bar: '#f43f5e', chipBg: '#fff1f2', chipText: '#be123c', avBg: '#ffe4e6', avText: '#9f1239', line: '#fb7185' },
  { bar: '#14b8a6', chipBg: '#f0fdfa', chipText: '#0f766e', avBg: '#ccfbf1', avText: '#115e59', line: '#2dd4bf' },
  { bar: '#6366f1', chipBg: '#eef2ff', chipText: '#4338ca', avBg: '#e0e7ff', avText: '#3730a3', line: '#818cf8' },
  { bar: '#d946ef', chipBg: '#fdf4ff', chipText: '#a21caf', avBg: '#fae8ff', avText: '#86198f', line: '#e879f9' },
]
const NEUTRAL = { bar: '#a1a1aa', chipBg: '#f4f4f5', chipText: '#3f3f46', avBg: '#e4e4e7', avText: '#3f3f46', line: '#d4d4d8' }

export function paletteFor(dept: string | null) {
  if (!dept || !dept.trim()) return NEUTRAL
  let h = 0
  for (let i = 0; i < dept.length; i++) h = (h * 31 + dept.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

export function initialsOf(name: string) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Placeholder/seed addresses (…@*.iat.test) aren't real contact info — don't show them.
export function shownEmail(email: string | null): string | null {
  return email && !/\.iat\.test$/i.test(email) ? email : null
}

function fmtDate(d: string | null) {
  if (!d) return null
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return null
  return dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Tidy-tree layout ─────────────────────────────────────────────────────────

type Layout = {
  pos: Map<string, XY>
  conns: { p: string; c: string }[]
  width: number
  height: number
  roots: string[]
}

function computeLayout(emps: OrgEmployee[]): Layout {
  const byId = new Map(emps.map((e) => [e.id, e]))
  const kids = new Map<string, string[]>()
  emps.forEach((e) => kids.set(e.id, []))
  const roots: string[] = []
  emps.forEach((e) => {
    if (e.manager_id && kids.has(e.manager_id)) kids.get(e.manager_id)!.push(e.id)
    else roots.push(e.id)
  })
  const sortIds = (ids: string[]) =>
    ids.sort((a, b) => {
      const ea = byId.get(a)!, eb = byId.get(b)!
      const sa = ea.org_sort ?? 9999, sb = eb.org_sort ?? 9999
      if (sa !== sb) return sa - sb
      return (ea.name || '').localeCompare(eb.name || '')
    })
  sortIds(roots)
  kids.forEach((v) => sortIds(v))

  const pos = new Map<string, XY>()
  let nextX = 0
  const place = (id: string, depth: number) => {
    const cs = kids.get(id)!
    const y = depth * LEVEL_H
    if (cs.length === 0) {
      pos.set(id, { x: nextX * SLOT, y })
      nextX++
    } else {
      cs.forEach((c) => place(c, depth + 1))
      const first = pos.get(cs[0])!.x
      const last = pos.get(cs[cs.length - 1])!.x
      pos.set(id, { x: (first + last) / 2, y })
    }
  }
  roots.forEach((r) => place(r, 0))

  const conns: { p: string; c: string }[] = []
  emps.forEach((e) => {
    if (e.manager_id && byId.has(e.manager_id)) conns.push({ p: e.manager_id, c: e.id })
  })

  let width = 0, height = 0
  pos.forEach((p) => {
    width = Math.max(width, p.x + NODE_W)
    height = Math.max(height, p.y + NODE_H)
  })
  return { pos, conns, width, height, roots }
}

function pathD(a: XY, b: XY) {
  const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2, y2 = b.y
  const my = (y1 + y2) / 2
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// ─── Component ─────────────────────────────────────────────────────────────────

export default function OrgChart({
  employees: initial,
  canEdit = true,
  title = 'Org chart',
  toolbarExtra,
}: {
  employees: OrgEmployee[]
  adminName?: string
  canEdit?: boolean
  title?: string
  toolbarExtra?: React.ReactNode
}) {
  const [employees, setEmployees] = useState<OrgEmployee[]>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [eraser, setEraser] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [query, setQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const [transform, setTransform] = useState<Transform>({ tx: 0, ty: 0, s: 0.75 })
  const [ready, setReady] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const [ghost, setGhost] = useState<{ id: string; dx: number; dy: number; overId: string | null } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const employeesRef = useRef(employees); employeesRef.current = employees
  const panRef = useRef({ active: false, sx: 0, sy: 0, tx0: 0, ty0: 0 })
  const dragRef = useRef<{ active: boolean; id: string; sx: number; sy: number; overId: string | null } | null>(null)
  const movedRef = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const allById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const kidsAll = useMemo(() => {
    const m = new Map<string, string[]>()
    employees.forEach((e) => m.set(e.id, []))
    employees.forEach((e) => { if (e.manager_id && m.has(e.manager_id)) m.get(e.manager_id)!.push(e.id) })
    return m
  }, [employees])

  const layoutEmps = useMemo(
    () => (showHidden ? employees : employees.filter((e) => e.org_visible)),
    [employees, showHidden],
  )
  const layout = useMemo(() => computeLayout(layoutEmps), [layoutEmps])
  const layoutRef = useRef(layout); layoutRef.current = layout

  // Pills reflect only the departments actually on the chart (the shown set), not
  // every employee row — otherwise hidden/legacy rows bleed extra categories in.
  const departments = useMemo(() => {
    const s = new Set<string>()
    layoutEmps.forEach((e) => { if (e.department?.trim()) s.add(e.department.trim()) })
    return Array.from(s).sort()
  }, [layoutEmps])

  const hiddenCount = useMemo(() => employees.filter((e) => !e.org_visible).length, [employees])

  // ── Toast ──
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3600)
  }, [])

  // ── Optimistic mutations ──
  const reassign = useCallback(async (childId: string, managerId: string | null) => {
    const list = employeesRef.current
    const child = list.find((e) => e.id === childId)
    if (!child || child.manager_id === managerId) return
    const newMgr = managerId ? list.find((e) => e.id === managerId) : null
    const hasReports = list.some((e) => e.manager_id === childId)
    // A person with no reports adopts their new manager's department (card recolors to the
    // team they joined). Team leads keep their dept so their team's color stays consistent.
    const newDept: string | undefined =
      (!hasReports && newMgr?.department && newMgr.department !== child.department) ? newMgr.department : undefined
    const priorMgr = child.manager_id
    const priorDept = child.department
    setEmployees((prev) => prev.map((e) => (e.id === childId
      ? { ...e, manager_id: managerId, department: newDept ?? e.department } : e)))
    try {
      await setManager(childId, managerId, newDept)
    } catch (err) {
      setEmployees((prev) => prev.map((e) => (e.id === childId
        ? { ...e, manager_id: priorMgr, department: priorDept } : e)))
      showToast(err instanceof Error ? err.message : 'Could not reassign')
    }
  }, [showToast])

  const toggleHidden = useCallback(async (id: string, visible: boolean) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, org_visible: visible } : e)))
    try {
      await setVisibility(id, visible)
    } catch (err) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, org_visible: !visible } : e)))
      showToast(err instanceof Error ? err.message : 'Could not update visibility')
    }
  }, [showToast])

  const saveInterests = useCallback(async (id: string, interests: string[]) => {
    const prior = employeesRef.current.find((e) => e.id === id)?.interests ?? []
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, interests } : e)))
    try {
      await setInterests(id, interests)
    } catch (err) {
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, interests: prior } : e)))
      showToast(err instanceof Error ? err.message : 'Could not save interests')
    }
  }, [showToast])

  // ── Pan / drag (window-level so it tracks outside the stage) ──
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (panRef.current.active) {
        const dx = e.clientX - panRef.current.sx
        const dy = e.clientY - panRef.current.sy
        movedRef.current = Math.max(movedRef.current, Math.abs(dx) + Math.abs(dy))
        setTransform((t) => ({ ...t, tx: panRef.current.tx0 + dx, ty: panRef.current.ty0 + dy }))
      } else if (dragRef.current?.active) {
        const d = dragRef.current
        const dx = e.clientX - d.sx
        const dy = e.clientY - d.sy
        movedRef.current = Math.max(movedRef.current, Math.abs(dx) + Math.abs(dy))
        let overId: string | null = null
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const nodeEl = el?.closest('[data-node-id]') as HTMLElement | null
        if (nodeEl) {
          const tid = nodeEl.getAttribute('data-node-id')
          if (tid && tid !== d.id) overId = tid
        }
        d.overId = overId
        setGhost({ id: d.id, dx, dy, overId })
      }
    }
    const onUp = (e: PointerEvent) => {
      if (dragRef.current?.active) {
        const d = dragRef.current
        let target = d.overId
        // Recompute the drop target at release (the ghost is pointer-events:none,
        // so elementFromPoint now sees the card underneath) — belt and suspenders.
        if (movedRef.current > 4) {
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          const tid = (el?.closest('[data-node-id]') as HTMLElement | null)?.getAttribute('data-node-id')
          if (tid && tid !== d.id) target = tid
        }
        if (movedRef.current > 4 && target) reassign(d.id, target)
        dragRef.current = null
        setGhost(null)
      }
      if (panRef.current.active) panRef.current.active = false
      setGrabbing(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [reassign])

  // ── Wheel zoom (non-passive so we can preventDefault) ──
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      // Don't hijack the wheel for zoom when the cursor is over the detail panel or
      // its dropdowns — let those scroll natively.
      if ((e.target as HTMLElement)?.closest?.('[data-panel]')) return
      e.preventDefault()
      const rect = stage.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setTransform((t) => {
        const ns = clamp(t.s * (e.deltaY < 0 ? 1.1 : 0.9), 0.3, 2)
        return { s: ns, tx: cx - (cx - t.tx) * (ns / t.s), ty: cy - (cy - t.ty) * (ns / t.s) }
      })
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  // ── Initial fit ──
  const fitView = useCallback((mode: 'all' | 'init') => {
    const stage = stageRef.current
    const L = layoutRef.current
    if (!stage || !L.width) return
    const W = stage.clientWidth, H = stage.clientHeight
    if (mode === 'all') {
      const s = clamp(Math.min((W - 64) / L.width, (H - 64) / L.height), 0.3, 1)
      setTransform({ s, tx: (W - L.width * s) / 2, ty: (H - L.height * s) / 2 })
    } else {
      const s = clamp(Math.min((W - 64) / L.width, 0.78), 0.4, 0.85)
      const rootX = L.roots.length ? (L.pos.get(L.roots[0])?.x ?? 0) + NODE_W / 2 : L.width / 2
      setTransform({ s, tx: W / 2 - rootX * s, ty: 40 })
    }
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(() => { fitView('init'); setReady(true) })
    return () => cancelAnimationFrame(id)
  }, [fitView])

  const zoomBy = (factor: number) => {
    const stage = stageRef.current
    if (!stage) return
    const cx = stage.clientWidth / 2, cy = stage.clientHeight / 2
    setTransform((t) => {
      const ns = clamp(t.s * factor, 0.3, 2)
      return { s: ns, tx: cx - (cx - t.tx) * (ns / t.s), ty: cy - (cy - t.ty) * (ns / t.s) }
    })
  }

  // ── Stage interactions ──
  const onStagePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-panel]')) return
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, tx0: transform.tx, ty0: transform.ty }
    movedRef.current = 0
    setGrabbing(true)
  }
  const onStageClick = (e: React.MouseEvent) => {
    if (movedRef.current > 4) return
    const t = e.target as HTMLElement
    if (t.closest('[data-node-id]') || t.closest('[data-panel]')) return
    setSelectedId(null)
  }

  // ── Node interactions ──
  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    if (eraser && editMode) { e.stopPropagation(); return }
    if (editMode) {
      e.stopPropagation()
      dragRef.current = { active: true, id, sx: e.clientX, sy: e.clientY, overId: null }
      movedRef.current = 0
      setGrabbing(true)
    }
    // view mode: let it bubble → stage pan; selection handled on click
  }
  const onNodeClick = (id: string) => {
    if (movedRef.current > 4) return
    if (eraser && editMode) { toggleHidden(id, false); return }
    setSelectedId(id)
  }

  // ── Search / filter dimming ──
  const isDim = useCallback((e: OrgEmployee) => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || [e.name, e.job_title, e.department, ...(e.interests || [])]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    const matchD = !deptFilter || e.department === deptFilter
    return !(matchQ && matchD)
  }, [query, deptFilter])

  const selected = selectedId ? allById.get(selectedId) ?? null : null
  const selDescendants = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const out = new Set<string>()
    const walk = (id: string) => (kidsAll.get(id) || []).forEach((c) => { if (!out.has(c)) { out.add(c); walk(c) } })
    walk(selectedId)
    return out
  }, [selectedId, kidsAll])

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300">
      {/* ── Header row — wraps on phones so the edit/zoom cluster gets its own
             line instead of crushing every button into 56px ── */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-2 px-4 sm:px-5 py-2.5 sm:py-0 sm:h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Network size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <h1 className="text-[15px] font-bold text-zinc-900 dark:text-white">{title}</h1>
          <span className="hidden sm:inline text-[12px] text-zinc-400 dark:text-zinc-500">
            · {layoutEmps.length} {layoutEmps.length === 1 ? 'person' : 'people'}{canEdit && hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </span>
          {toolbarExtra && <div className="ml-2 flex-shrink-0">{toolbarExtra}</div>}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <>
              <Toggle on={editMode} onClick={() => { setEditMode((v) => { if (v) setEraser(false); return !v }) }} icon={<Pencil size={14} />} label="Edit" tone="emerald" />
              <Toggle on={eraser} disabled={!editMode} onClick={() => setEraser((v) => !v)} icon={<Eraser size={14} />} label="Erase" tone="rose" />
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
            </>
          )}
          <IconBtn onClick={() => zoomBy(0.85)} title="Zoom out"><ZoomOut size={15} /></IconBtn>
          <span className="text-[11px] tabular-nums text-zinc-500 w-9 text-center">{Math.round(transform.s * 100)}%</span>
          <IconBtn onClick={() => zoomBy(1.18)} title="Zoom in"><ZoomIn size={15} /></IconBtn>
          <IconBtn onClick={() => fitView('all')} title="Fit to screen"><Maximize2 size={15} /></IconBtn>
        </div>
      </div>

      {/* ── Filter row ── */}
      <div className="flex items-center gap-2.5 px-5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 flex-shrink-0 overflow-x-auto">
        <div className="relative flex-shrink-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="h-8 w-44 pl-8 pr-3 text-[12px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {departments.map((d) => {
            const p = paletteFor(d)
            const on = deptFilter === d
            return (
              <button
                key={d}
                onClick={() => setDeptFilter(on ? null : d)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  on ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                     : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: p.bar }} />
                {d}
              </button>
            )
          })}
        </div>
        <div className="flex-1" />
        {canEdit && hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden((v) => !v)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
              showHidden ? 'border-emerald-300 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
                         : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
            {showHidden ? 'Showing hidden' : 'Show hidden'}
          </button>
        )}
      </div>

      {/* ── Canvas ── */}
      <div
        ref={stageRef}
        onPointerDown={onStagePointerDown}
        onClick={onStageClick}
        className="relative flex-1 overflow-hidden select-none"
        style={{
          cursor: grabbing ? 'grabbing' : eraser && editMode ? 'crosshair' : 'grab',
          backgroundImage: 'radial-gradient(circle, rgba(113,113,122,0.18) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {employees.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-zinc-400">
            No active employees yet.
          </div>
        ) : (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.s})`, width: layout.width, height: layout.height }}
          >
            {/* connectors */}
            <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" width={layout.width} height={layout.height}>
              {layout.conns.map(({ p, c }) => {
                const a = layout.pos.get(p), b = layout.pos.get(c)
                if (!a || !b) return null
                const hot = selectedId === p || selectedId === c
                const pal = paletteFor(allById.get(c)?.department ?? null)
                return (
                  <path
                    key={`${p}-${c}`}
                    d={pathD(a, b)}
                    fill="none"
                    stroke={pal.line}
                    strokeWidth={hot ? 2.4 : 1.5}
                    strokeOpacity={hot ? 0.95 : 0.45}
                  />
                )
              })}
            </svg>

            {/* nodes */}
            {layoutEmps.map((e) => {
              const pos = layout.pos.get(e.id)
              if (!pos) return null
              const pal = paletteFor(e.department)
              const reports = kidsAll.get(e.id)?.length ?? 0
              const dim = isDim(e)
              const isGhost = ghost?.id === e.id
              const isOver = ghost?.overId === e.id
              const sel = selectedId === e.id
              const hidden = !e.org_visible
              const tx = pos.x + (isGhost ? (ghost!.dx) / transform.s : 0)
              const ty = pos.y + (isGhost ? (ghost!.dy) / transform.s : 0)
              return (
                <div
                  key={e.id}
                  data-node-id={e.id}
                  onPointerDown={(ev) => onNodePointerDown(ev, e.id)}
                  onClick={() => onNodeClick(e.id)}
                  className="absolute top-0 left-0 group rounded-xl border bg-white dark:bg-zinc-900 shadow-sm"
                  style={{
                    width: NODE_W,
                    height: NODE_H,
                    transform: `translate(${tx}px, ${ty}px)${isGhost ? ' scale(1.03)' : ''}`,
                    transition: ready && !isGhost ? 'transform .4s cubic-bezier(.4,0,.2,1)' : 'none',
                    zIndex: isGhost ? 50 : sel ? 20 : 1,
                    opacity: dim ? 0.2 : hidden ? 0.55 : 1,
                    borderColor: sel ? '#10b981' : isOver ? '#34d399' : undefined,
                    borderStyle: hidden ? 'dashed' : 'solid',
                    boxShadow: sel ? '0 0 0 2px #10b981' : isOver ? '0 0 0 2px #34d399' : undefined,
                    cursor: editMode && !eraser ? 'grab' : 'pointer',
                    paddingLeft: 16,
                    pointerEvents: isGhost ? 'none' : undefined,
                  }}
                >
                  <span className="absolute left-[7px] top-3 bottom-3 w-[3px] rounded-full" style={{ background: pal.bar }} />
                  <div className="flex items-center gap-2.5 px-3 pt-2.5">
                    {e.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: pal.avBg, color: pal.avText }}>
                        {initialsOf(e.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate max-w-[120px]">{e.name}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">{e.job_title || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 mt-2">
                    {e.department ? (
                      <span className="text-[10px] font-medium px-2 py-[2px] rounded-full truncate max-w-[110px]" style={{ background: pal.chipBg, color: pal.chipText }}>
                        {e.department}
                      </span>
                    ) : <span />}
                    {reports > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                        <Users size={12} />{reports}
                      </span>
                    )}
                  </div>

                  {/* edit-mode affordances */}
                  {editMode && !eraser && (
                    <>
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={13} />
                      </span>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); toggleHidden(e.id, false) }}
                        title="Hide from chart"
                        className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full border border-rose-300 dark:border-rose-500/50 bg-white dark:bg-zinc-900 text-rose-500 items-center justify-center hidden group-hover:flex"
                      >
                        <EyeOff size={12} />
                      </button>
                    </>
                  )}
                  {hidden && (
                    <button
                      onClick={(ev) => { ev.stopPropagation(); toggleHidden(e.id, true) }}
                      title="Restore to chart"
                      className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full border border-emerald-300 dark:border-emerald-500/50 bg-white dark:bg-zinc-900 text-emerald-600 flex items-center justify-center"
                    >
                      <Eye size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* mode hint */}
        <div className="absolute left-4 bottom-4 text-[11px] text-zinc-400 dark:text-zinc-600 pointer-events-none">
          {eraser && editMode ? 'Eraser on — click anyone to hide them.'
            : editMode ? 'Edit on — drag a card onto another to reassign, or click to open.'
            : 'Drag to pan · scroll to zoom · click a card for details.'}
        </div>

        {/* detail panel */}
        <DetailPanel
          key={selected?.id || 'none'}
          selected={selected}
          allById={allById}
          kidsAll={kidsAll}
          employees={employees}
          selDescendants={selDescendants}
          editMode={editMode}
          onClose={() => setSelectedId(null)}
          onSelect={(id) => setSelectedId(id)}
          onReassign={reassign}
          onToggleHidden={toggleHidden}
          onSaveInterests={saveInterests}
        />

        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 px-3.5 py-2 rounded-lg bg-rose-600 text-white text-[12px] font-medium shadow-lg" data-panel>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Toolbar bits ───────────────────────────────────────────────────────────

function Toggle({ on, onClick, icon, label, tone, disabled }: {
  on: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone: 'emerald' | 'rose'; disabled?: boolean
}) {
  const toneCls = tone === 'emerald'
    ? 'border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
    : 'border-rose-300 dark:border-rose-500/50 text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border transition-colors ${
        disabled ? 'border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
          : on ? toneCls
          : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      }`}
    >
      {icon}{label}
    </button>
  )
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {children}
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  selected, allById, kidsAll, employees, selDescendants, editMode,
  onClose, onSelect, onReassign, onToggleHidden, onSaveInterests,
}: {
  selected: OrgEmployee | null
  allById: Map<string, OrgEmployee>
  kidsAll: Map<string, string[]>
  employees: OrgEmployee[]
  selDescendants: Set<string>
  editMode: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onReassign: (childId: string, managerId: string | null) => void
  onToggleHidden: (id: string, visible: boolean) => void
  onSaveInterests: (id: string, interests: string[]) => void
}) {
  const [interestInput, setInterestInput] = useState('')
  const [mgrOpen, setMgrOpen] = useState(false)

  const pal = paletteFor(selected?.department ?? null)
  const manager = selected?.manager_id ? allById.get(selected.manager_id) ?? null : null
  const reports = selected ? (kidsAll.get(selected.id) || []).map((id) => allById.get(id)!).filter(Boolean) : []
  const joined = fmtDate(selected?.hire_date ?? null)

  const mgrOptions = useMemo(() => {
    if (!selected) return []
    return employees
      .filter((e) => e.id !== selected.id && !selDescendants.has(e.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [employees, selected, selDescendants])

  const addInterest = () => {
    if (!selected) return
    const v = interestInput.trim()
    if (!v) return
    if ((selected.interests || []).some((x) => x.toLowerCase() === v.toLowerCase())) { setInterestInput(''); return }
    onSaveInterests(selected.id, [...(selected.interests || []), v])
    setInterestInput('')
  }

  return (
    <div
      data-panel
      className={`absolute top-0 right-0 h-full w-[300px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl transition-transform duration-300 ease-out overflow-y-auto ${
        selected ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {selected && (
        <div className="p-5">
          <button onClick={onClose} className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" title="Close">
            <X size={18} />
          </button>

          {selected.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold" style={{ background: pal.avBg, color: pal.avText }}>
              {initialsOf(selected.name)}
            </span>
          )}
          <h2 className="mt-3 text-[17px] font-bold text-zinc-900 dark:text-white">{selected.name}</h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{selected.job_title || '—'}</p>
          {selected.department && (
            <span className="inline-block mt-2 text-[11px] font-medium px-2.5 py-[3px] rounded-full" style={{ background: pal.chipBg, color: pal.chipText }}>
              {selected.department}
            </span>
          )}
          {!selected.org_visible && (
            <span className="inline-flex items-center gap-1 ml-2 mt-2 text-[11px] text-rose-500"><EyeOff size={12} /> Hidden</span>
          )}

          {/* Contact */}
          <Section label="Contact" />
          {shownEmail(selected.email) && <KV icon={<Mail size={14} />} value={shownEmail(selected.email)!} />}
          {selected.phone && <KV icon={<Phone size={14} />} value={selected.phone} />}
          {joined && <KV icon={<Calendar size={14} />} value={`Joined ${joined}`} />}
          {!shownEmail(selected.email) && !selected.phone && !joined && <p className="text-[12px] text-zinc-400">No contact details.</p>}
          {selected.bio && <p className="mt-2 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{selected.bio}</p>}

          {/* Interests */}
          <Section label="Interests" />
          <div className="flex flex-wrap gap-1.5">
            {(selected.interests || []).length === 0 && !editMode && (
              <span className="text-[12px] text-zinc-400">None yet.</span>
            )}
            {(selected.interests || []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {t}
                {editMode && (
                  <button onClick={() => onSaveInterests(selected.id, selected.interests.filter((x) => x !== t))} className="text-zinc-400 hover:text-rose-500">
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {editMode && (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={interestInput}
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }}
                placeholder="Add an interest…"
                className="h-8 flex-1 px-2.5 text-[12px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button onClick={addInterest} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Reports to */}
          <Section label="Reports to" />
          {editMode ? (
            <div className="relative">
              <button
                onClick={() => setMgrOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[12px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <UserCog size={14} className="text-zinc-400 flex-shrink-0" />
                  {manager ? manager.name : 'Top level (no manager)'}
                </span>
                <ChevronDown size={14} className={`text-zinc-400 transition-transform ${mgrOpen ? 'rotate-180' : ''}`} />
              </button>
              {mgrOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMgrOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 max-h-60 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
                    <button
                      onClick={() => { onReassign(selected.id, null); setMgrOpen(false) }}
                      className="w-full text-left px-3 py-2 text-[12px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center gap-2"
                    >
                      <CornerDownRight size={13} className="text-zinc-400" /> Top level (no manager)
                      {!selected.manager_id && <Check size={13} className="ml-auto text-emerald-500" />}
                    </button>
                    {mgrOptions.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => { onReassign(selected.id, o.id); setMgrOpen(false) }}
                        className="w-full text-left px-3 py-2 text-[12px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center gap-2"
                      >
                        <span className="truncate">{o.name}</span>
                        <span className="text-zinc-400 truncate">· {o.job_title || '—'}</span>
                        {selected.manager_id === o.id && <Check size={13} className="ml-auto text-emerald-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : manager ? (
            <PersonRow e={manager} onClick={() => onSelect(manager.id)} />
          ) : (
            <p className="text-[12px] text-zinc-400">Top of the org.</p>
          )}

          {/* Direct reports */}
          <Section label={`Direct reports (${reports.length})`} />
          {reports.length === 0 ? (
            <p className="text-[12px] text-zinc-400">No direct reports.</p>
          ) : (
            <div className="space-y-1">
              {reports.map((r) => <PersonRow key={r.id} e={r} onClick={() => onSelect(r.id)} />)}
            </div>
          )}

          {/* Edit footer */}
          {editMode && (
            <button
              onClick={() => { onToggleHidden(selected.id, !selected.org_visible) }}
              className={`mt-5 w-full inline-flex items-center justify-center gap-2 h-9 rounded-lg text-[12px] font-medium border transition-colors ${
                selected.org_visible
                  ? 'border-rose-300 dark:border-rose-500/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'
                  : 'border-emerald-300 dark:border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
              }`}
            >
              {selected.org_visible ? <><EyeOff size={14} /> Hide from chart</> : <><Eye size={14} /> Restore to chart</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label }: { label: string }) {
  return <h3 className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">{label}</h3>
}

function KV({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-zinc-600 dark:text-zinc-300 my-1">
      <span className="text-zinc-400 flex-shrink-0">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}

function PersonRow({ e, onClick }: { e: OrgEmployee; onClick: () => void }) {
  const pal = paletteFor(e.department)
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-left">
      {e.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: pal.avBg, color: pal.avText }}>
          {initialsOf(e.name)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-zinc-800 dark:text-zinc-100 truncate">{e.name}</span>
        <span className="block text-[11px] text-zinc-400 truncate">{e.job_title || '—'}</span>
      </span>
    </button>
  )
}
