-- ─────────────────────────────────────────────────────────────────────────────
-- 049_email_events.sql — Permanent record of every email Resend sends
--
-- Resend's dashboard only retains email logs for ~30 days, and its webhooks are
-- ephemeral. To keep a forever-history of outbound mail (ticket confirmations,
-- form-submission notices, PTO decisions, customer invites, digests, SRV, tools,
-- etc.) we capture Resend's webhook events into a table WE own and never expire.
--
-- The Resend webhook (app/api/webhooks/resend/route.ts) upserts one row PER
-- EMAIL, keyed on Resend's email_id. As the same email moves through its
-- lifecycle (email.sent → delivered → opened/clicked → bounced/complained) the
-- single row's `status` advances in place — the route only moves it "forward"
-- so a late-arriving `delivered` can't clobber a terminal `bounced`.
--
-- The /admin/audit "Emails" tab reads this table with pagination.
--
-- Internal data: RLS ON, NO policies — service-role only, same posture as
-- login_events (031) / audit_log (020). Reads go through supabaseAdmin in the
-- server-rendered admin page; the webhook writes with the service role too.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id      text        NOT NULL UNIQUE,          -- Resend email id (upsert key)
  to_addresses  text[]      NOT NULL DEFAULT '{}',    -- recipient(s)
  from_address  text,
  subject       text,
  status        text        NOT NULL DEFAULT 'sent',  -- sent|delivered|opened|clicked|bounced|complained|delivery_delayed
  last_event    text,                                 -- raw last Resend event type (e.g. email.delivered)
  sent_at       timestamptz,                          -- first email.sent timestamp
  last_event_at timestamptz NOT NULL DEFAULT now(),   -- timestamp of the most-advanced event seen
  bounce_detail text,                                 -- bounce / complaint reason, when present
  raw           jsonb,                                -- last full webhook payload, for forensics
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_events_last_event_idx ON email_events (last_event_at DESC);
CREATE INDEX IF NOT EXISTS email_events_status_idx     ON email_events (status);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
