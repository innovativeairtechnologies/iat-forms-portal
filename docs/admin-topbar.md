# Admin top bar (`AdminTopBar`)

The shared operations top bar shown on **every `/admin/*` page**: breadcrumb ·
page actions · search · notifications bell · profile avatar.

- **Component:** `app/admin/AdminTopBar.tsx` (client)
- **Rendered from:** `app/admin/layout.tsx` — once, above every page's own scroll
  container, so it's consistent across the whole admin surface. Wrapped in
  `PageChromeProvider` so detail pages can feed it their record crumb + actions.
- **Breadcrumb derivation:** `app/admin/crumbs.ts` (`crumbsFor` + the `ROUTES`
  map), shared with `PageChrome` so the top bar and the detail page never disagree.
- **Client pieces reused:** `TopBarSearch` + `TopBarBell` (`app/admin/TopBarActions.tsx`)
  and `DashboardPresetPicker` (`app/admin/DashboardPresetPicker.tsx`).

## Anatomy

| Element        | Source | Notes |
| -------------- | ------ | ----- |
| Breadcrumb     | route + `PageChrome` | `crumbsFor(pathname)` gives `Section › Page` (longest-prefix match against `ROUTES`). A detail/editor page appends the record crumb via `<PageChrome record={…}>`, so it reads `Operations › Equipment › 26-5875`; the Page crumb becomes a link to its list once a record follows it. Add a page to `ROUTES` to give it a breadcrumb. |
| Page actions   | `PageChrome` (detail/editor pages) · `DashboardGrid` (the dashboard's "Edit dashboard" toolbar) | Buttons a page hoists up (Save, Delete, Print, status pills, Edit dashboard…), portaled into the `#admin-topbar-actions` slot. `empty:hidden` keeps it out of the layout on pages with no actions. |
| Search         | `TopBarSearch` | Opens the ⌘K command palette. |
| View-switcher  | `DashboardPresetPicker` | Retired from general use — `showPresets` defaults to `false`. |
| Bell           | `TopBarBell` | Unread submissions (emerald dot) + open tickets (rose dot); counts come from the layout. |
| Avatar         | layout | First initial of `admin.displayName`, links to `/admin/profile`. |

## Detail & editor pages — `PageChrome`

Instead of rendering their own second breadcrumb bar, detail/editor pages use
`app/admin/PageChrome.tsx`:

```tsx
<PageChrome record={equipment.serial_number}>
  <DeleteRecordButton … />
  <button form="equip-form">Save</button>
</PageChrome>
```

- `record` (`string | Crumb[]`) is appended to the derived `Section › Page` trail.
  A string is one trailing crumb; a `Crumb[]` is several (e.g. a project nested
  under a department).
- `children` are the page's action buttons.
- **Desktop:** the record crumb is added to `AdminTopBar` (via context) and the
  actions are portaled into its `#admin-topbar-actions` slot → one bar.
- **Mobile:** `AdminTopBar` is hidden, so `PageChrome` renders its own sticky bar
  (list crumb + record + actions), matching the old `DetailTopBar`.

Works from both Server and Client Components (e.g. the submissions and forms-tally
pages are Server Components that pass client action children through).

## Behavior

- **Desktop only** (`hidden md:flex`). On mobile the `AdminSidebar` fixed bar
  (logo + hamburger) is the top chrome — plus `PageChrome`'s own bar on detail
  pages — so there are never two stacked bars. The layout's `pt-14 md:pt-0`
  clears the mobile bar.
- Suppressed on `/admin/home` (renders its own `HomeTopBar`).
- `preset` is read from the `iat_dash_preset` cookie in the layout and passed down.

## Other surfaces

- The customer ticket page still uses `DetailTopBar` (`components/admin/detail-ui.tsx`);
  the customer surface has no shared top bar, so it never stacked.
- The employee surface (`EmployeeShell`) uses its own `PortalTopBar`.
- **Learn is done** (2026-07-30). It used to stack a generic `PortalTopBar` over an
  inline `<Breadcrumb>`, and its crumb was hardcoded wrong ("Learn › Browse › Lesson"
  on category and module pages too). The whole surface moved into the admin shell at
  `/admin/learn`, `LearnShell` and `components/learn/Breadcrumb.tsx` are deleted, and
  the category/module/lesson pages now feed their record crumbs up through
  `<PageChrome record={[...]}>` like every other detail page. See `docs/learn.md`.
