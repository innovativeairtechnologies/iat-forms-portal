# Mobile pattern — admin lists & portal shells

How the portal behaves on phones (< 640px / Tailwind `sm`), and the rules for
keeping new pages mobile-safe. Shipped 2026-07-14 (see CHANGELOG).

## The rule

**Nothing scrolls sideways on a phone.** A list row shows only what's needed to
know what you're tapping into — identity (bold title over muted subtitle),
one status pill or key metric, and usually an age — and the row's detail
page/modal carries everything else. This is the `/admin/audit` look, applied
portal-wide.

## How it's built (shared kit, `components/admin/list.tsx`)

1. **`TableScroll`** — the min-width floor (and therefore horizontal scrolling)
   only applies from `sm` up: `sm:min-w-[var(--table-min)]`. Below `sm` the
   grid must fit the viewport on its own.
2. **Responsive `COLS`** — every list declares a two-tier template:

   ```ts
   const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[34px_2fr_140px_90px_40px]'
   ```

   The mobile tier lists *only the tracks that survive on a phone*
   (`minmax(0,1fr)` for the identity cell so long titles truncate instead of
   blowing the row open). Cells that don't survive get `hidden sm:flex` /
   `hidden sm:block` — `display:none` grid items don't occupy tracks, so the
   two tiers stay in sync as long as the number of *visible* cells matches the
   mobile track count.
3. **Column headers hide on phones** — `hidden sm:grid ${COLS} ${HEADER_BOX}`.
   The rows read as a feed. Exception: keep the header when a mobile column is
   a bare number that needs its label (see Accrual).
4. **Desktop-only chrome** — bulk-select checkboxes (`<SelectBox
   className="hidden sm:flex" …/>`), kebab menus, chevrons, and inline-edit
   inputs are all `hidden sm:*`. Phones act through the row tap.
5. **Actions that must survive** — if a queue has no detail page (PTO/Sick
   requests), let the action tray wrap onto its own line:
   `col-span-full sm:col-auto` on the actions cell (ROW uses `min-h`, so the
   row grows).

## What each list keeps on a phone

| List | Mobile columns |
| --- | --- |
| Submissions / Tickets / Troubleshooting | identity · status · age |
| Forms | name · active-toggle · Edit |
| Equipment | serial-identity · warranty pill |
| Gantt | project-identity · ship window |
| Customers | company-identity · status |
| Presentations | deck-identity · status |
| Employees | identity · status |
| Accrual | identity · PTO balance · sick balance (header kept) |
| PTO / Sick | identity · balance · status, actions wrap below |
| Deals Pipeline | customer · total cost · status select (+ Total Value & Weighted tiles) |
| Deals CRM | customer · quoted date · status |
| Deals Focused | customer · weighted · open-modal button |
| US Rotors | identity · status select |

## Shell fixes worth remembering

- The fixed mobile top bar (admin + employee shells) is cleared by
  `pt-14 md:pt-0` **on the layout's content column** — an `h-14` spacer div
  inside the flex-*row* shell does nothing (zero width) and was the cause of
  page headers hiding behind the logo/hamburger.
- Don't give a page wrapper `h-screen` inside those shells — on phones the
  column is viewport *minus* the 56px bar, so `h-screen` overflows and the
  bottom clips (org chart had this). Use `flex-1 min-h-0`.
- Toolbars with many controls (org chart) get `flex-wrap` + `sm:h-14` instead
  of a fixed height.
