-- ─────────────────────────────────────────────────────────────────────────────
-- 079_proposals.sql — AI-drafted, human-approved equipment proposals.
--
-- A proposal turns a Deal plus a Sizing Studio selection into a branded,
-- submittal-ready PDF. Claude writes only the cover letter and the scope
-- narrative; every NUMBER is templated from the snapshot below and never
-- generated, so a figure cannot be invented.
--
-- ── Why this table carries a full snapshot ──────────────────────────────────
-- The Sizing Studio persists NOTHING — no table, no localStorage; the clipboard
-- is the only way a run leaves the page. So creating a proposal is the act that
-- first makes a selection durable, and this row is the only record of it.
--
-- Both `sizing_inputs` AND `sizing_result` are stored, deliberately. The inputs
-- alone would be enough to replay the run today (calculateSizing is pure and
-- deterministic), but the ENGINE will change — that is the whole point of
-- lib/desmod.ts — and the catalog it selects against is fetched live from
-- DryWare. An approved proposal has to render the same numbers in a year, so
-- the computed result is frozen alongside the inputs that produced it.
--
-- ── Why a new table rather than columns on `deals` ──────────────────────────
-- A proposal has its own lifecycle (draft → in_review → approved), its own
-- review queue, and must outlive the deal it came from. Note the DryWare sync
-- would NOT have clobbered a new column — `drywareFields()` in
-- lib/dryware-deals.ts is an 11-column allowlist and everything else survives an
-- upsert — but that is not the reason for the split.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SET NULL, not CASCADE: an approved proposal is a document that was sent to a
  -- customer. Deleting the deal must not destroy the record of what we quoted.
  deal_id              uuid REFERENCES deals(id) ON DELETE SET NULL,

  -- Customer framing, snapshotted. deals.customer is DryWare-owned free text and
  -- is rewritten on every sync, so it cannot be relied on as the name printed on
  -- a document a human approved.
  title                text NOT NULL DEFAULT '',
  customer_name        text NOT NULL DEFAULT '',
  job_name             text NOT NULL DEFAULT '',
  site_location        text,
  prepared_for         text,

  -- The two human-written grounding inputs Claude drafts from. It is shown these
  -- and a set of QUALITATIVE technical descriptors — never a figure — so it has
  -- no number available to misplace. See buildFacts() in lib/proposals.ts.
  application_input    text NOT NULL DEFAULT '',
  requirements_input   text NOT NULL DEFAULT '',

  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'in_review', 'approved')),

  -- ── The selection snapshot ────────────────────────────────────────────────
  sizing_inputs        jsonb,
  sizing_result        jsonb,
  -- 'dryware' | 'fallback' — which catalog the selection was made against. A
  -- proposal built while DryWare was unreachable is not the same artifact.
  catalog_source       text CHECK (catalog_source IN ('dryware', 'fallback')),
  -- The DesMod verification (request + response + reconciliation), or NULL when
  -- the selection was never verified. NULL is what makes a proposal preliminary.
  verification         jsonb,

  -- ── The prose ─────────────────────────────────────────────────────────────
  draft_sections       jsonb,   -- Claude's original, immutable
  edited_sections      jsonb,   -- the human working copy
  claims               jsonb,   -- statement → source, for the review panel
  gaps                 jsonb,   -- what the draft needs but did not have
  flags                jsonb,   -- any digit Claude wrote; must be cleared to approve
  model                text,

  generated_by         uuid REFERENCES employees(id) ON DELETE SET NULL,
  generated_at         timestamptz,
  submitted_by         uuid REFERENCES employees(id) ON DELETE SET NULL,
  submitted_at         timestamptz,
  approved_by          uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at          timestamptz,
  review_notes         text,

  -- ── The approved artifact ─────────────────────────────────────────────────
  -- Path in the private `proposal-docs` bucket. Written on approval so there is
  -- an immutable record of exactly what left the building.
  pdf_path             text,
  pdf_generated_at     timestamptz,

  created_by           uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposals_deal_idx   ON proposals (deal_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON proposals (status);
CREATE INDEX IF NOT EXISTS proposals_updated_idx ON proposals (updated_at DESC);

CREATE OR REPLACE FUNCTION set_proposals_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_set_updated_at ON proposals;
CREATE TRIGGER proposals_set_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_proposals_updated_at();

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only, same posture as deals(043)
-- and case_studies(072). Access is gated in-app by requireProposalsAuth.

-- ── Storage: the approved PDF ────────────────────────────────────────────────
-- Private. Writes go through a signed upload URL issued by an admin-gated route;
-- reads are short-lived signed URLs minted server-side. Same posture as
-- `admin-submittals` (035) and `crib-photos` (050).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('proposal-docs', 'proposal-docs', false, 20971520)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- ── Permission seed ──────────────────────────────────────────────────────────
-- Sales writes proposals; approval is a separate hard-coded role check in
-- requireProposalsAuth ({ approve: true } → admin only), NOT a delegatable perm.
-- MUST mirror DEFAULT_ROLE_PERMS in lib/roles.ts — scripts/check-perm-seed.mjs
-- asserts the two agree, and once role_permissions has rows the code defaults
-- are dead at runtime, so this INSERT is what actually grants access.

INSERT INTO role_permissions (role, perm) VALUES
  ('sales', 'proposals')
ON CONFLICT (role, perm) DO NOTHING;
