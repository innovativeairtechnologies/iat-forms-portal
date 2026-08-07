-- ─────────────────────────────────────────────────────────────────────────────
-- 084_soo.sql — Sequence of Operation builder.
--
-- Sales brings a DryWare Sales Submittal PDF to the portal; the portal confirms
-- the unit's configuration with a human and assembles the project SOO from a
-- master clause library. ONE DOCUMENT = ONE UNIT (decided 2026-08-06), so there
-- is no units child table — the facts live on the document row.
--
-- ── Why the library is versioned, when srv_config is not ────────────────────
-- lib/soo-library.ts follows the srv_config pattern (migration 046): one row,
-- whole-blob JSON, code default as fail-safe fallback. But SRV content is a
-- checklist someone fills in, while this content is a CONTROLS CONTRACT that
-- gets handed to the controls contractor and checked at commissioning.
--
-- An engineer editing a master clause would otherwise silently change what an
-- approved document regenerates as, with nothing recording that it moved. So
-- every save appends to soo_library_versions, and approving a document pins the
-- version it was built from. Same reasoning as 079_proposals.sql freezing
-- sizing_result: an approved document has to still mean the same thing in a
-- year. Cheap now, painful to retrofit.
--
-- ── Why the submittal is KEPT ───────────────────────────────────────────────
-- app/api/admin/customers/extract-submittal deletes its upload in a `finally`
-- block, because there it is customer PII the route no longer needs. Here the
-- submittal is the EVIDENCE behind every extracted fact — the reviewer clicks
-- through to page 28 to check a value. Different bucket, opposite convention.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The master clause library ────────────────────────────────────────────────
-- Single row, id = 1. `library` is a SooLibrary (see lib/soo.ts): sections →
-- clauses → children, each clause carrying a `requires` predicate over UnitFacts
-- and `{{slot}}` bindings. NULL/absent row ⇒ lib/soo-library.ts falls back to
-- SOO_MASTER_LIBRARY in code, so assembly never fails on a DB hiccup.
CREATE TABLE IF NOT EXISTS soo_library (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library     jsonb NOT NULL,
  updated_by  uuid REFERENCES employees(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Append-only history. Never UPDATE or DELETE a row here: an approved document
-- points at one of these by version, and rewriting it would rewrite the meaning
-- of a document someone signed.
CREATE TABLE IF NOT EXISTS soo_library_versions (
  version     integer PRIMARY KEY,
  library     jsonb NOT NULL,
  note        text,
  created_by  uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS soo_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Snapshotted, not joined. Same reasoning as proposals(079): the customer and
  -- project names printed on an approved document must not change underneath it
  -- when some upstream record is edited or re-synced.
  title             text NOT NULL DEFAULT '',
  customer_name     text NOT NULL DEFAULT '',
  project_name      text NOT NULL DEFAULT '',
  unit_tag          text,

  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'in_review', 'approved')),

  -- ── The confirmed unit configuration ──────────────────────────────────────
  -- A UnitFacts object (lib/soo.ts). NULL until a human confirms it. Every key
  -- present; null within it means UNKNOWN, never "absent" — that distinction is
  -- what lets the assembler block a clause instead of silently dropping it.
  facts             jsonb,
  -- Per-fact { page, snippet, method } sidecar. Deliberately NOT merged into
  -- `facts`: predicates must evaluate against a clean typed object. Populated by
  -- Phase 2 extraction; a hand-entered document records method = 'human'.
  provenance        jsonb,
  -- Extraction disagreements a human has yet to settle. Non-empty blocks approval.
  conflicts         jsonb,
  -- Project setpoints (space dewpoint, LAT setpoints…). Owned by neither the
  -- submittal nor the library — they come off the mechanical spec or are dialled
  -- in at commissioning. A required one left unset renders a visible placeholder
  -- AND blocks approval, rather than quietly taking a plausible default.
  setpoints         jsonb,

  -- ── The assembled document ────────────────────────────────────────────────
  -- An AssemblyResult: the included sections PLUS the excluded, blocked and
  -- uncovered lists. All three are stored, because "what was left out and why"
  -- is the completeness receipt — a reader has to be able to tell "not
  -- applicable" from "nobody ever wrote this".
  assembled         jsonb,
  -- The human working copy: per-clause text overrides. The assembled result
  -- above stays immutable, mirroring draft_sections/edited_sections in 079.
  overrides         jsonb,
  -- Which library version produced `assembled`. Pinned on approval.
  library_version   integer,

  -- Path in the private `soo-submittals` bucket. Kept — see the header.
  submittal_path    text,

  assembled_at      timestamptz,
  submitted_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  submitted_at      timestamptz,
  approved_by       uuid REFERENCES employees(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  review_notes      text,

  created_by        uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soo_documents_status_idx  ON soo_documents (status);
CREATE INDEX IF NOT EXISTS soo_documents_updated_idx ON soo_documents (updated_at DESC);

CREATE OR REPLACE FUNCTION set_soo_documents_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS soo_documents_set_updated_at ON soo_documents;
CREATE TRIGGER soo_documents_set_updated_at
  BEFORE UPDATE ON soo_documents
  FOR EACH ROW EXECUTE FUNCTION set_soo_documents_updated_at();

ALTER TABLE soo_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE soo_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE soo_library_versions ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only, same posture as proposals(079),
-- case_studies(072) and deals(043). Access is gated in-app by requireSooAuth.

-- ── Storage: the source submittal ────────────────────────────────────────────
-- Private. Writes go through a signed upload URL issued by an admin-gated route;
-- reads are short-lived signed URLs minted server-side. 25MB — the Ferrara
-- sample is 15.2MB, and submittals grow with the number of vendor cut sheets
-- DryWare staples on, so 20MB (the proposal-docs limit) is too close.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('soo-submittals', 'soo-submittals', false, 26214400)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

-- ── Permission seed ──────────────────────────────────────────────────────────
-- Sales starts the document (they are the ones who download the submittal from
-- DryWare); engineering reviews it. APPROVAL is a separate hard-coded check in
-- requireSooAuth ({ approve: true } → admin or engineering), NOT a delegatable
-- perm: signing off a control narrative is an engineering judgement, so unlike
-- proposals it is not admin-only — but sales cannot self-approve.
--
-- MUST mirror DEFAULT_ROLE_PERMS in lib/roles.ts — scripts/check-perm-seed.mjs
-- asserts the two agree, and once role_permissions has rows the code defaults
-- are dead at runtime, so this INSERT is what actually grants access.
INSERT INTO role_permissions (role, perm) VALUES
  ('sales', 'soo'),
  ('engineering', 'soo')
ON CONFLICT (role, perm) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
-- SELECT id, status, library_version FROM soo_documents;
-- SELECT version, created_at, note FROM soo_library_versions ORDER BY version;
-- SELECT id, file_size_limit FROM storage.buckets WHERE id = 'soo-submittals';
-- SELECT role, perm FROM role_permissions WHERE perm = 'soo';
