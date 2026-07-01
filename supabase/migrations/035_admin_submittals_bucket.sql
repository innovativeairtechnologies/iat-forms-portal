-- ─────────────────────────────────────────────────────────────────────────────
-- 035_admin_submittals_bucket.sql — private Storage bucket for Submittal scans
--
-- The "Scan a Submittal PDF" tool (NewCustomerWizard) previously sent the whole
-- file as base64 inside the POST body to /api/admin/customers/extract-submittal.
-- Vercel's serverless functions cap request bodies at ~4.5MB, so any Submittal
-- over ~3MB was silently rejected by the platform before the route ever ran —
-- the browser just got a non-JSON error back ("Could not read that file"),
-- regardless of whatever size limit the route's own code checked.
--
-- Fix: the browser now uploads the file directly to this bucket via a signed
-- upload URL (mirrors ticket-attachments, migration 019), and the extract
-- route downloads it server-side (an outbound fetch, not subject to the
-- inbound body-size limit) before handing it to Claude. The file is deleted
-- right after extraction — it's not needed afterward and may contain
-- customer PII.
--
-- public=false: admin-gated only, all access via the service-role client.
-- No storage.objects policies needed (writes go through a signed upload URL
-- issued by an admin-gated route; reads/deletes go through the service role).
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('admin-submittals', 'admin-submittals', false, 20971520) -- 20MB
on conflict (id) do update set file_size_limit = 20971520;
