# Customer Portal (`/customer`)

Phase 1 — 2026-06-24. External customers get a login to track their equipment,
build & shipping status, warranty, and support. Branded to IAT.

## Who it's for
One login per customer **company** (`profiles.role = 'customer'`, linked via
`profiles.customer_id`). A login sees every unit linked to that company.

## Data model (migration 026_customer_portal.sql)
- `customers` — one row per customer company (name, contact, phone, location; nullable
  `logo_url` / `accent_color` reserved for future white-label).
- `profiles.customer_id` — links a login to its company; `profiles.role` now allows `'customer'`.
- `equipment.customer_id` — links each unit to its owning customer.
- `equipment_milestones` — the staff-updated build→ship timeline shown on the portal.

All four are **service-role only** (RLS on, no policies). The `/customer` pages run
server-side and fetch only the logged-in customer's rows (`lib/customer-auth.ts` →
`getCustomerUser`), so the browser never queries these tables and one customer can never
read another's data — same posture as `/admin`.

## Provisioning (admin)
`/admin/equipment/[id]` → **Customer Portal** card → **Invite to portal**:
1. (Optional) **Scan a Submittal PDF** — Claude extracts company / contact / unit fields to
   pre-fill the form (`POST /api/admin/customers/extract-submittal`, reuses the form-builder
   document-extraction pattern).
2. **Create account** (`POST /api/admin/customers/invite`) — creates the `customers` row + the
   auth login (email confirmed), sets `profiles.role='customer'` + `customer_id`, links the
   unit, seeds the build/ship tracker, and emails a set-password (Supabase recovery) link. The
   dialog also shows a copyable set-password link as a fallback.

Staff advance the tracker from the **Build & Shipping** card
(`POST` seeds defaults, `PATCH` updates a milestone — `/api/admin/equipment/[id]/milestones`).

## Customer experience
- Set-password link → `/auth/callback` → `/customer/welcome` (choose password) → `/customer`.
- Dashboard: unit cards (serial / model / warranty), build & shipping tracker, KB + start-up
  guide, the support forms, and "My Requests" (their tickets + troubleshooting intakes).
- Future log-ins: `/login` with their email + password (middleware routes them to `/customer`).

## Ops / deploy notes
- Apply `supabase/migrations/026_customer_portal.sql` (done 2026-06-24).
- Supabase Auth → URL Configuration allowlist must include `${APP_URL}/auth/callback`.
- Customer email sends from `onboarding@resend.dev` until a Resend domain is verified —
  delivery is limited; use the copyable setup link from the invite dialog meanwhile.
- No new env vars.

## Deferred (later phases)
- IAT Assistant chatbot (currently a styled placeholder).
- Parts & PM support forms (still disabled on `/support`).
- Pre-filling the support forms with the customer's unit.
- "New from Submittal" one-shot create on the equipment **list** page — the invite API already
  accepts a full `equipment` object, so this just needs a UI entry point.
- Per-customer white-label (the `logo_url` / `accent_color` columns already exist).
