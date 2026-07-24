# Microsoft SSO (Entra ID)

Staff sign in with their `@dehumidifiers.com` Microsoft account from `/login`, alongside the
existing email/password form. Shipped 2026-07-24. Scoping/rationale lives in the parent
`docs/microsoft-sso-mfa-plan.md`; this file is the operational reference.

## How it fits

Nothing about authorization changed. This only changes how a staff member *proves* who they are
before `profiles.role` takes over — `middleware.ts`, the permission matrix and RLS are untouched.
Customers keep email + password; they have no Entra accounts, and the app registration is
single-tenant, so a customer clicking the button fails at Microsoft's own login screen.

MFA is **not built here**. It comes from whatever Conditional Access / Security Defaults policy
the tenant already applies to M365 sign-in. If no MFA prompt appears, that is an Entra policy
scoping question (the new app registration may need adding to the policy's target list), not a
code change.

## Configuration

| Where | Setting | Value |
|---|---|---|
| Entra app registration | Supported account types | Single tenant |
| Entra app registration | Redirect URI | `https://<project>.supabase.co/auth/v1/callback` |
| Entra app registration | API permissions | `User.Read` (delegated) is sufficient |
| Supabase → Auth → Providers → Azure | Azure Tenant URL | `https://login.microsoftonline.com/<TENANT-GUID>` |
| Supabase → Auth → URL Configuration | Redirect URLs | production + any preview host being tested |

### The Azure Tenant URL is easy to get wrong

Supabase derives **two** different values from that one field
(`supabase/auth`, `internal/api/provider/azure.go`):

```go
authHost       := chooseHost(ext.URL, defaultAzureAuthBase)
AuthURL         = authHost + "/oauth2/v2.0/authorize"   // no /v2.0 in the field
expectedIssuer  = authHost + "/v2.0"                    // /v2.0 appended here
```

So two rules, and each has its own failure signature:

- **No trailing `/v2.0`.** Entra's OpenID-configuration URL contains `/v2.0`, but that suffix is
  Supabase's to add. Including it builds `…/v2.0/oauth2/v2.0/authorize` → **404 at Microsoft**.
- **Use the tenant GUID, not the domain.** Microsoft normalizes every issuer to the GUID, so a
  domain here builds `…/dehumidifiers.com/v2.0` and mismatches the token's `…/{GUID}/v2.0`. That
  surfaces as **"Error getting user profile from external provider"** — misleading, because the
  authorize step succeeds and it only fails at the profile step.

Smoke-test the whole connector without deploying anything:

```bash
curl -sI "https://<project>.supabase.co/auth/v1/authorize?provider=azure"
```

Follow the `Location:` header and expect **HTTP 200** from Microsoft. A 404 means a malformed
tenant URL. The URL should read `…/<GUID>/oauth2/v2.0/authorize`.

## The two callback gates

`app/auth/callback/route.ts` applies these only to Microsoft sign-ins (no `?type=` **and** an
azure identity on the resolved user). Both read the verified session, never a URL param.

1. **Domain** — email must end in `@dehumidifiers.com`, failing closed on a missing email.
   Rejection → `/login?error=sso_domain`.
2. **Provisioning** — the user must already carry an `email` identity, proving an admin invite
   created the account. Rejection → `/login?error=sso_no_account`.

Gate 2 exists because the migration-002 trigger `handle_new_user_profile` creates a `profiles`
row at the `employee`/`production` tier for **every** new `auth.users` row, and `production` is
an admin-surface role since the portal consolidation. Without it, any member of the M365 tenant
could self-provision a portal account by clicking the button — accounts are meant to exist only
by admin invite with a deliberate role. **Do not loosen this gate to make `sso_no_account` go
away**; that error means the gate is working.

Rejected users keep an inert `auth.users` row (no password, blocked on every retry). Cleanup is
deliberately left to an admin rather than auto-deleting accounts from inside a callback.

`scopes: 'openid profile email'` is load-bearing — Supabase's azure default is `openid` alone,
which returns no email claim, and both gates key off the email.

## Account linking

Verified against the live project 2026-07-24: Supabase **auto-links by verified email**. An
existing staff member signing in with Microsoft for the first time lands on their existing
account with their role and history intact — no duplicate, no role-less profile. Confirmed via a
`login_events` row with `method=microsoft` and the correct role.

If that behavior ever changes, the symptom is an existing user being bounced with
`sso_no_account` (they'd arrive with an azure-only identity), and the fix is explicit linking in
the callback rather than relaxing gate 2.

## Testing on a preview

Vercel preview deployments sit behind Deployment Protection — a browser without a `_vercel_jwt`
cookie gets 302'd to `vercel.com/sso-api`, which intercepts the OAuth redirect back before
Next.js sees it. Team members can sign in via Vercel SSO first; anyone else needs a shareable
preview link or Vercel Authentication disabled for previews.

Note `curl -L` reports **HTTP 200** for a walled preview because it follows the redirect to
Vercel's login page. Check for `Location: …vercel.com/sso-api` on an unfollowed request instead.

## Still open

- **Break-glass account** — one admin that stays on password auth permanently, so an Entra
  outage can't lock everyone out. Not yet chosen.
- Full cutover (retiring password sign-in for staff) vs indefinite dual sign-in.
- The `sso_no_account` deny path has not been exercised live — only the allow path.
