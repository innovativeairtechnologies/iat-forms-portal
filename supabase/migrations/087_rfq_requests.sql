-- ─────────────────────────────────────────────────────────────────────────────
-- 087_rfq_requests.sql — the public Request for Quote / moisture survey.
--
-- /support/rfq is a guided moisture survey that replaces the two Word documents
-- ("IAT Quote Request and Moisture Survey Form" — Room and Process) that were
-- previously emailed around as attachments. A submission lands here, and the
-- customer walks away with a branded PDF of everything they entered.
--
-- ── Why a table of its own, not `submissions` ────────────────────────────────
-- `submissions` rows are rendered by iterating `form_fields`, so anything not
-- backed by a builder field simply does not display. The RFQ is a hand-built
-- wizard with two divergent branches (room vs process), nested door rows and a
-- computed load estimate — modelling that as ~70 builder fields would produce a
-- form nobody could edit and a detail page that renders half of it. It is also
-- a SALES artefact with a different lifecycle from a form response.
--
-- ── Why the estimate is stored, not recomputed ───────────────────────────────
-- `summary` is a snapshot of the numbers the customer was shown at the moment
-- they pressed send, and of the numbers printed in the PDF they downloaded. The
-- load engine (lib/rfq.ts) will be refined; when it is, replaying `data` would
-- silently produce different figures from the document in the customer's inbox.
-- Keep both: `data` is what they said, `summary` is what we told them.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rfq_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- RFQ-YYYY-NNNN. Printed on the PDF and quoted back to the customer, so it is
  -- allocated atomically (see next_rfq_number below) and never reused.
  reference      text NOT NULL UNIQUE,

  -- 'room' | 'process' — the fork at the top of the wizard. Denormalised out of
  -- `data` because every list view and every triage decision starts here.
  track          text NOT NULL DEFAULT 'room',

  -- Preset key ('warehouse', 'dry-room', …) plus the resolved human label, so a
  -- list can be read without loading lib/rfq.ts's preset table.
  application    text NOT NULL DEFAULT '',
  application_label text NOT NULL DEFAULT '',

  -- Contact + project identity, lifted out of `data` for search and sorting.
  company        text NOT NULL DEFAULT '',
  contact_name   text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  project_name   text NOT NULL DEFAULT '',
  location       text NOT NULL DEFAULT '',
  date_required  date,

  -- The full wizard state, exactly as submitted.
  data           jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The preliminary load/process estimate shown on screen and printed on the PDF.
  summary        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Desk workflow. Deliberately short — this is a triage queue, not a pipeline;
  -- once it is real work it becomes a deal.
  status         text NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'reviewing', 'quoted', 'closed')),
  is_read        boolean NOT NULL DEFAULT false,
  internal_notes text NOT NULL DEFAULT '',

  -- Set when a signed-in portal customer submits; anonymous submissions are the
  -- normal case and leave this null.
  submitted_by   uuid,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfq_requests_created_idx ON public.rfq_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS rfq_requests_status_idx  ON public.rfq_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS rfq_requests_email_idx   ON public.rfq_requests (lower(email));

-- Service-role only. The public wizard writes through /api/rfq (supabaseAdmin),
-- which bypasses RLS; nothing anon or authenticated may read a stranger's survey.
ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;

-- ── Reference allocation ─────────────────────────────────────────────────────
-- Same shape as next_ticket_number (029): a per-year counter incremented inside
-- one locked statement, seeded above anything already present, so two people
-- pressing send in the same instant cannot collide.

CREATE TABLE IF NOT EXISTS public.rfq_counters (
  year     int PRIMARY KEY,
  last_seq int NOT NULL DEFAULT 0
);

ALTER TABLE public.rfq_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_rfq_number(p_year int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq int;
BEGIN
  INSERT INTO public.rfq_counters (year, last_seq)
  VALUES (
    p_year,
    COALESCE(
      (
        SELECT max((regexp_replace(reference, '^RFQ-' || p_year || '-', ''))::int)
        FROM public.rfq_requests
        WHERE reference ~ ('^RFQ-' || p_year || '-[0-9]+$')
      ),
      0
    ) + 1
  )
  ON CONFLICT (year) DO UPDATE
    SET last_seq = public.rfq_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  RETURN v_seq;
END;
$$;
