# Customer Portal (`/customer`)

Phase 1 — 2026-06-24. External customers get a login to track their equipment,
build & shipping status, warranty, and support. Branded to IAT. The admin
**Customers** front door (customer-first provisioning) was added 2026-06-25.

## Who it's for
One login per customer **company** (`profiles.role = 'customer'`, linked via
`profiles.customer_id`). A login sees every unit linked to that company.

## Data model (migration 026_customer_portal.sql)
- `customers` — one row per customer company (name, contact, phone, location; `status`
  active/inactive; nullable `logo_url` / `accent_color` reserved for future white-label).
- `profiles.customer_id` — links a login to its company; `profiles.role` now allows `'customer'`.
- `equipment.customer_id` — links each unit to its owning customer.
- `equipment_milestones` — the staff-updated build→ship timeline shown on the portal.

All four are **service-role only** (RLS on, no policies). The `/customer` pages run
server-side and fetch only the logged-in customer's rows (`lib/customer-auth.ts` →
`getCustomerUser`), so the browser never queries these tables and one customer can never
read another's data — same posture as `/admin`.

## Provisioning (admin)
Two entry points, **one** backend (`POST /api/admin/customers/invite` — creates/links the
customer + equipment, seeds the tracker, and emails the invite):

**Customer-first — `/admin/customers` → New Customer** (the front door):
1. **Scan a Submittal PDF** — Claude extracts the customer **and** unit fields
   (`POST /api/admin/customers/extract-submittal`). Review/edit before sending.
2. **Create account & send invite** — creates the `customers` row, the auth login
   (`role='customer'` + `customer_id`), the `equipment` row (upsert by serial — links if it
   already exists), seeds the build/ship tracker, and emails a temp password + Sign In link.
   The dialog also shows the temp password to hand off if email delivery isn't set up.

The same wizard (`components/admin/NewCustomerWizard.tsx`) is the equipment list's
**"New from Submittal"** button.

**Equipment-first — `/admin/equipment/[id]` → Customer Portal card → Invite to portal:**
links *this* existing unit to a new/existing customer (same backend, `equipment_id` path).

Staff advance the tracker from the **Build & Shipping** card
(`POST` seeds defaults, `PATCH` updates a milestone — `/api/admin/equipment/[id]/milestones`).

## Managing customers (admin)
- **`/admin/customers`** — searchable list (Company / Contact / Location / Units / Status),
  Active/Inactive filters.
- **`/admin/customers/[id]`** — contact details + linked units, and two actions:
  - **Resend invite** (`POST …/resend-invite`) — resets the temp password, re-sends the email,
    re-activates the account.
  - **Remove from portal** (`POST …/remove`) — deletes the login so they can't sign in and marks
    the customer **inactive**; the company + its equipment + history are kept (re-invite to restore).
  Both are audited (`customer.resend_invite`, `customer.remove`).

## Authentication note
No magic/recovery link: admin-generated links use Supabase's implicit flow and need each redirect
origin allowlisted, which is brittle across preview/prod. Instead the invite emails a **temp
password**; first sign-in is gated by `/customer/welcome`, which forces the customer to set their
own password. Mirrors the employee invite flow. The login link uses the request's origin, so a
preview invite points at the preview and a prod invite at prod.

## Customer experience
- Invite email → **Sign In** at `/login` with the temp password → `/customer/welcome` forces a new
  password → `/customer`.
- Dashboard: unit cards (serial / model / warranty), build & shipping tracker, **build & QC
  photos** (admin-uploaded, expandable gallery), KB + start-up guide, the support forms, a
  **Contact Us** card (IAT team roster + a message form that emails the team), and "My Requests"
  (their tickets + troubleshooting intakes).
- **Photos** come from the admin equipment record (`/admin/equipment/[id]` → Photos card →
  Upload). Files go browser → Supabase Storage (`ticket-photos` bucket) → `equipment.photo_urls`.
- **Contact Us** form → `POST /api/customer/contact` → emails the IAT team
  (`jacob.younker@dehumidifiers.com`); the customer's identity is taken from the session.
- Future log-ins: `/login` with their email + password (middleware routes them to `/customer`).

## Ops / deploy notes
- Apply `supabase/migrations/026_customer_portal.sql` (done 2026-06-24). The admin front door
  added 2026-06-25 needs **no migration**.
- Customer email sends from `onboarding@resend.dev` until a Resend domain is verified —
  delivery is limited; use the temp password shown in the invite/resend dialog meanwhile.
- No new env vars.

## Deferred (later phases)
- IAT Assistant chatbot (currently a styled placeholder) — Phase 3, read-only Q&A grounded in the
  customer's equipment + KB.
- Parts & PM support forms (still disabled on `/support`).
- Pre-filling the support forms with the customer's unit.
- Per-customer white-label (the `logo_url` / `accent_color` columns already exist).
- "Rep vs D2C" provenance flag on the customer (deferred pending review).
