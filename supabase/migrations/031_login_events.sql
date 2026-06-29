-- ─────────────────────────────────────────────────────────────────────────────
-- 031_login_events.sql  — sign-in accountability trail (all portals)
--
-- One row per successful sign-in across every portal (admin, employee, customer)
-- and every method (password, magic-link, invite, password recovery). Answers
-- "who logged in, from where, on what device, and when" — the companion to
-- audit_log (mig 020), which records what admins *do* once inside.
--
-- Written best-effort from server code via lib/login-events.ts (never blocks the
-- sign-in it describes). Identity (user_id/role) is resolved server-side from the
-- authenticated session, so it can't be spoofed by the client. IP + geo + device
-- are derived from the request headers (Vercel populates x-forwarded-for and the
-- x-vercel-ip-* geo headers). Internal data: RLS on, NO policies — service-role
-- only, like audit_log / ticket_notes. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                                     -- auth user id of who signed in
  email       text,                                     -- denormalized (resilient to deletes)
  name        text,                                     -- denormalized display name
  role        text,                                     -- 'admin' | 'employee' | 'customer'
  portal      text,                                     -- portal landed in: 'admin' | 'employee' | 'customer' | 'learn'
  method      text,                                     -- 'password' | 'magic_link' | 'invite' | 'recovery'
  ip          text,                                     -- client IP (x-forwarded-for, first hop)
  city        text,                                     -- from x-vercel-ip-city
  region      text,                                     -- from x-vercel-ip-country-region
  country     text,                                     -- from x-vercel-ip-country
  timezone    text,                                     -- from x-vercel-ip-timezone
  user_agent  text,                                     -- raw User-Agent string
  browser     text,                                     -- parsed, e.g. 'Chrome', 'Safari'
  os          text,                                     -- parsed, e.g. 'Windows', 'iOS'
  device      text,                                     -- 'desktop' | 'mobile' | 'tablet'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_created_idx ON login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_user_idx    ON login_events (user_id);
CREATE INDEX IF NOT EXISTS login_events_role_idx    ON login_events (role);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)
