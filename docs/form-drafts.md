# Save & resume form drafts

Stop a form mid-fill and resume it later — built so a reviewer can start a performance
review on their desktop, pause, and finish on their phone. Added 2026-06-30.

## Two modes (same filler)
`StepFormModal` (the multi-step filler behind the Employee Forms tab **and**
`/forms/[slug]`) autosaves progress, debounced, as the user fills:

- **Account drafts (cross-device)** — when opened from the **logged-in portal**
  (`EmployeeFormsView` passes `serverDrafts`). Progress is saved to the user's account
  via `PUT /api/drafts`, so it's available on any device they log into.
- **Local drafts (same-device)** — the fallback for **anonymous** `/forms/[slug]`
  fills (no login). Progress is kept in this browser's `localStorage`.

Either way an accidental close / refresh / crash never loses work; the draft is
**cleared on successful submit**. A "Saved" cue appears in the header, and a resume
banner ("Resumed your saved progress… · Start over") shows when a draft is restored.

## Resume
The Employee Forms tab (`/employee/resources`, `/admin/employee-forms`) shows a
**"Continue where you left off"** list of the user's in-progress account drafts —
each labelled by the form + the "Employee Name" answer (if present) + when it was
saved. Click **Resume** to reopen exactly where they left off, or **Discard**.
**Multiple drafts per form** are allowed on purpose (a manager mid-way through several
reviews at once).

In **admin**, the Employee Forms tab is reached from the sidebar ("Employees" →
**Employee Forms**, beside the "Forms" manager). That nav item carries an **amber
count badge** of the admin's unfinished drafts (`getUserFormDraftCount`, wired through
the admin layout) so a reviewer sees at a glance they have reviews to finish.

## Data + API
- **`form_drafts`** (migration `033_form_drafts.sql`) — `id` (client-generated uuid),
  `user_id`, `form_id`, `label`, `data` (jsonb), `current_step`, `updated_at`.
  Service-role only; the browser never touches it directly.
- **`/api/drafts`** — `GET` (the caller's drafts, joined to form title/slug), `PUT`
  (idempotent upsert; ownership-checked), `DELETE?id=` (own drafts only). The acting
  user always comes from the session (`createSupabaseServer().auth.getUser()`), never
  the request body. `lib/drafts.ts#getUserFormDrafts` is the server-side read used by
  the Employee Forms pages.

## Notes
- File/Blob answers aren't stored in a draft (they exist only transiently before
  upload); everything else (text, choices, signatures-as-data-URLs) is.
- Without migration 033 the feature degrades gracefully: autosave no-ops, the Resume
  list is empty — no errors.
