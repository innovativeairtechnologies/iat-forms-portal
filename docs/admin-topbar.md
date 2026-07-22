# Admin top bar (`AdminTopBar`)

The shared operations top bar shown on **every `/admin/*` page**: breadcrumb ·
search · (contextual view-switcher) · notifications bell · profile avatar.

- **Component:** `app/admin/AdminTopBar.tsx` (client)
- **Rendered from:** `app/admin/layout.tsx` — once, above every page's own scroll
  container, so it's consistent across the whole admin surface.
- **Client pieces reused:** `TopBarSearch` + `TopBarBell` (`app/admin/TopBarActions.tsx`)
  and `DashboardPresetPicker` (`app/admin/DashboardPresetPicker.tsx`).

## Anatomy

| Element        | Source | Notes |
| -------------- | ------ | ----- |
| Breadcrumb     | route  | `crumbsFor(pathname)` — longest-prefix match against the `ROUTES` map (mirrors the sidebar sections). Add a page here to give it a breadcrumb. |
| Search         | `TopBarSearch` | Opens the ⌘K command palette. |
| View-switcher  | `DashboardPresetPicker` | The "Balanced / Tickets / Submissions" layout toggle. **Dashboard only** — `showPresets` defaults to `pathname === '/admin'`. On other pages this slot is free for per-page actions. |
| Bell           | `TopBarBell` | Unread submissions (emerald dot) + open tickets (rose dot); counts come from the layout. |
| Avatar         | layout | First initial of `admin.displayName`, links to `/admin/profile`. |

## Behavior

- **Desktop only** (`hidden md:flex`). On mobile the `AdminSidebar` fixed bar
  (logo + hamburger) is the top chrome, so there are never two stacked bars. The
  layout's `pt-14 md:pt-0` clears that mobile bar.
- `preset` is read from the `iat_dash_preset` cookie in the layout (same as the
  dashboard) and passed down so the view-switcher shows the current layout.

## Extending

- **Per-page actions:** pass `crumbs` and/or wire a page-specific actions node into
  the contextual slot (currently the view-switcher on the dashboard).
- **Other surfaces:** the employee (`EmployeeShell`) and Learn (`LearnShell`)
  surfaces still use their own `PortalTopBar`. Unifying them onto `AdminTopBar`
  would need a non-admin data/permission context (their notifications and profile
  targets differ), so it's deliberately out of scope for this pass.
