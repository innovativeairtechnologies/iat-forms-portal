-- ─────────────────────────────────────────────────────────────────────────────
-- 025_troubleshooting_ai.sql
-- Phase 2 of the Troubleshooting Checklist (/support/troubleshooting): persist the
-- AI troubleshooting tips generated from the customer's answers, mirroring
-- tickets.ai_recommendations. Shown on the pre-submit AI card, the success screen,
-- the confirmation/CS emails, and the status-lookup result.
--
-- Additive + nullable — safe on the live table, existing rows untouched.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.troubleshooting_intakes
  ADD COLUMN IF NOT EXISTS ai_recommendations text[];
