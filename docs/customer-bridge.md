# Customer Bridge (`/api/bridge/*`)

The machine-to-machine surface between this app and the **customer portal**
(`iat-customer`, its own Vercel deployment + its own Supabase project).

## Why it exists

Customers used to log into this app at `/customer`, against this database. Phase 2 of the
portal consolidation moved them out entirely: the customer deployment has no credential to
this database and no admin code in its bundle, so a compromise there can't reach company data.

But IAT still *authors* the things customers need to see — equipment, build milestones, ticket
status, KB articles. Those stay here. The bridge is the only way across.

## Endpoints

All are `POST`, all require a valid signature (below).

| Path | Direction | Purpose |
| --- | --- | --- |
| `/api/bridge/equipment` | read | The customer's units + milestones + computed warranty state |
| `/api/bridge/tickets` | read | "My Requests" — tickets + historical troubleshooting intakes |
| `/api/bridge/kb` | read | Published KB articles (no customer scope — already public) |
| `/api/bridge/warranty` | write | File a warranty claim |

## Authentication — `lib/bridge-auth.ts`

`requireBridgeAuth(request, path)` verifies:

```
x-iat-timestamp : Date.now() as a string
x-iat-signature : HMAC-SHA256 hex over `${timestamp}.POST.${path}.${rawBody}`
```

- Signed with `INTERNAL_BRIDGE_SECRET`, shared with the customer deployment.
- The timestamp is **inside** the signed payload and checked for freshness (±5 min), so a
  captured request can't be replayed later.
- Comparison is `timingSafeEqual`, with a length check first (it throws on mismatched lengths).
- **Fails closed when the secret is unset** — returns 503. Without that guard an empty secret
  would make every unsigned request verify against `HMAC("")` and open the entire surface.
- The raw body is signed, so verification reads `request.text()` and parses afterwards;
  re-serializing parsed JSON could reorder keys and break the signature.

Its own named guard rather than a shared one, following the convention documented on
`requireDealsAuth` in `lib/api-auth.ts`: one guard per surface, so widening one can never
silently widen another.

## The trust boundary

**A valid signature proves the request came from the customer deployment — nothing more.** It
does not vouch for the `customerId` in the body. Every endpoint independently scopes its query
to that id and re-checks ownership:

- `equipment` / `tickets` — queries are filtered by `customer_id`.
- `warranty` — the unit lookup is scoped by **both** `id` and `customer_id`, so a unit belonging
  to another customer simply isn't found; `serial_number` is snapshotted from the equipment row,
  never taken from the request.
- `tickets` — additionally re-filters results to drop any row whose `customer_id` is set to a
  different customer, so an email or serial match can't pull in someone else's ticket.

### Security narrowing vs. the old in-app pages

`app/customer/page.tsx` matched tickets against the **logged-in user's email**, which it could
trust because it owned the session. The bridge cannot: an email supplied by the caller would let
a compromised customer deployment read another company's tickets by passing their address. So
the bridge derives the email from the customer's own `customers.contact_email`.

Practical effect: a ticket matching only a customer's *personal* email — not the company contact
email, no serial, no `customer_id` — won't appear. Those are anonymous `/support` submissions;
they still surface once linked or matched by serial. Closing a cross-tenant hole is worth that
edge case.

## Column projection

Every endpoint lists columns explicitly. The internal pages can use `select('*')` because their
view mapping (`UnitView`, `RequestView`) discards internal fields before the RSC boundary — a
JSON bridge has no such backstop, so a bare `*` would put `owner_id`, staff `notes`,
`resolved_reason`, `ai_recommendations`, `viewed_kb_articles`, `customer_phone` and friends
straight on the wire.

## Shared logic

Warranty and milestone logic is **imported, not reimplemented**, so the two portals can't drift:

- `lib/equipment.ts` — `effectiveWarrantyEnd`, `warrantyState`, `daysUntilWarrantyEnd`
- `lib/customer.ts` — `milestoneProgress`

Note `warrantyState` returns only `'in' | 'out' | 'unknown'`. **There is no `expiring` state in
the data layer** — "expiring soon" is a presentation rule (`state === 'in' && daysLeft <= 90`)
applied in the UI on both sides.

## The other direction: provisioning (internal → customer)

Everything above is customer→internal. There is exactly **one** call the other way, and it's
the only way a login can come to exist in the customer project — there is no self-signup.

`lib/customer-portal.ts` → `provisionCustomerPortalAccount({ op, customerId, ... })` signs a
request (same contract, same secret) to the customer app's `POST /api/provision`:

| op | Called from | Effect on the customer project |
| --- | --- | --- |
| `create` | `/api/admin/customers/invite` | Upserts the company mirror + creates/resets the login with the same temp password the welcome email carries |
| `deactivate` | `/api/admin/customers/[id]/remove` | Deletes the logins, marks the company inactive |
| `delete` | `DELETE /api/admin/customers/[id]` | Deletes the logins and the mirror row |

`customerId` is the internal `customers.id`, reused verbatim as the mirror-row id, so both
systems share one key and can't drift.

**The removal ops are not optional.** Deleting a customer here without deleting their login
there leaves an orphaned login pointing at a company that no longer exists — exactly the
`/customer ↔ /login` redirect loop this app already shipped a fix for once.

Provisioning is **best-effort at the call site**: the internal account is already usable by the
time it runs, so a failure never fails the invite or rolls anything back. But every call site
records the outcome in the audit log (`customer_portal_provisioned`), and `remove`/`delete`
return a flag, so a silent divergence between the two systems is always traceable.

### Backfilling existing customers

`node scripts/backfill-customer-portal.mjs [--dry-run] [--all]` walks the customers table and
provisions each one through the same endpoint — one code path for creating customer logins,
with the script as a bulk driver. Accounts get a fresh random temp password that is **not**
emailed: the goal is to get accounts and mirrors in place so the bridge can be exercised, not
to spray credentials at customers before cutover. At cutover, re-run the invite flow (which
does email) or have customers use password reset.

## Configuration

| Variable | Where | Notes |
| --- | --- | --- |
| `INTERNAL_BRIDGE_SECRET` | this app | Shared secret, used in BOTH directions. Until it's set, every bridge call returns 503 — the endpoints ship inert. |
| `INTERNAL_BRIDGE_SECRET` | `iat-customer` | Must match exactly. Also gates `/api/provision`. |
| `INTERNAL_BRIDGE_URL` | `iat-customer` | This app's origin. Until set, the customer app degrades to "temporarily unavailable" cards rather than erroring. |
| `CUSTOMER_PORTAL_URL` | this app | The customer deployment's origin (e.g. `https://iat-customer.vercel.app`). Until set, provisioning is skipped and logged as `skipped (not configured)` — invites still work internally. |

Generate the secret with something like `openssl rand -hex 32` and set it in **both** Vercel
projects. It is a credential: never commit it, and rotate by updating both projects together.
