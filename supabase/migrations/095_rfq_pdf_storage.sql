-- ─── Keep the quote PDF the customer actually received ───────────────────────
--
-- The RFQ PDF is built by jsPDF in the CUSTOMER'S BROWSER (lib/rfq-pdf.ts says so
-- at the top — it reaches for <canvas> to downscale the logo). The server has
-- never had a copy. So when an engineer picks up a quote request they can see the
-- survey answers but not the document the customer is holding, and the two can
-- diverge the moment the template changes.
--
-- This stores the exact bytes the browser produced, once, at submit time.
--
-- ⚠️ PRIVATE bucket, unlike `ticket-photos`. An RFQ PDF carries the customer's
-- contact details, site location and project economics on page one. It is served
-- through a short-lived signed URL from the authenticated admin page, never a
-- public link — a public object URL is guessable-by-leak and permanent.
--
-- ⛔ The customer's browser does NOT write here directly. Anonymous storage
-- writes are an open concern in the ideas backlog (§8.2) and this deliberately
-- does not widen them: the browser POSTs the bytes to /api/rfq/pdf, which
-- validates and writes with the service role. Do not add an anon INSERT policy to
-- this bucket to "simplify" the upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rfq-pdfs', 'rfq-pdfs', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Where the object lives, relative to the bucket. NULL means we never received
-- one — an older request, or a browser that failed to build it. Every consumer
-- must treat NULL as normal rather than an error.
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS pdf_path text;

-- When it landed. Separate from created_at because the upload is a second request
-- that can arrive seconds later, fail, or never come at all.
ALTER TABLE public.rfq_requests
  ADD COLUMN IF NOT EXISTS pdf_stored_at timestamptz;

COMMENT ON COLUMN public.rfq_requests.pdf_path IS
  'Object path in the private rfq-pdfs bucket: the exact PDF the customer downloaded, uploaded by their browser via /api/rfq/pdf. NULL is normal (pre-2026-08-25 rows, or the browser never sent one).';
