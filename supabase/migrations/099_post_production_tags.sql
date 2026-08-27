-- ─────────────────────────────────────────────────────────────────────────────
-- 099_post_production_tags.sql — walkarounds from the shop floor, no login.
--
-- 098 gave post-production to people who hold `engineering_jobs`. That is two
-- roles, and the meeting it was built from was about FOUR perspectives:
--
--   "…from the engineer standpoint. The production guy's standpoint, who built
--    it, the electrician's point of view from the guy who wired it, uh, and even
--    the guy who tested it."
--
-- Three of those four have no portal account and are not getting one. So the
-- unit gets a QR sticker: scan it, say who you are, and walk. Same shape and the
-- same posture as the production board (055) — /board/<token> proved the floor
-- will use a page that costs them nothing to open.
--
-- ── SECURITY ────────────────────────────────────────────────────────────────
-- RLS on, NO policies — service-role only, exactly as 055 argues at length.
-- "Public page" must NOT become "public table": an anon SELECT policy here would
-- expose pp_tags over PostgREST, so one GET with the publishable anon key would
-- dump every row INCLUDING every token — a single request enumerating every
-- "unguessable" sticker. The page resolves the token server-side with
-- supabaseAdmin and returns only what that one tag opens.
--
-- THE TOKEN IS THE CREDENTIAL. Anyone holding the link can start a walkaround
-- and attach photos, video and audio to it, and the name they type is
-- unverified. That is the accepted trade for a floor with no logins, and it is
-- why `source` and `walked_by_role` exist: a finding that came off a sticker
-- must be legible AS having come off a sticker, forever, rather than being
-- indistinguishable from one an engineer signed in to file.
--
-- What that costs is bounded on purpose. A tag can be deactivated or its token
-- rotated (every printed QR dies at once); writes are rate-limited; media goes
-- to the same PRIVATE bucket 098 created and is only ever read back through the
-- admin-gated route. Nothing on the scan page displays a customer name, a price,
-- or anything you would not pin to the break-room wall.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Token mint ───────────────────────────────────────────────────────────────
-- Deliberately its OWN function rather than calling 055's prod_board_token().
-- The body is identical and that is fine: these two features must be droppable
-- independently, and a post-production sticker minting itself through something
-- named "prod_board_token" would read as a bug to whoever finds it next.
--
-- 43 URL-safe chars, 244 bits — unguessable by brute force, which matters
-- because rate limiting cannot protect a page render.
--
-- Built from two gen_random_uuid()s rather than gen_random_bytes(24) for the
-- reason 055 spells out: the former is CORE Postgres and CSPRNG-backed, while
-- gen_random_bytes lives in pgcrypto, which Supabase installs into the
-- `extensions` schema — so any later hardening with `SET search_path = public`
-- would stop resolving it and every insert would die.
CREATE OR REPLACE FUNCTION pp_tag_token() RETURNS text AS $$
  SELECT rtrim(translate(encode(decode(
           replace(gen_random_uuid()::text, '-', '') ||
           replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
         '+/', '-_'), '=');
$$ LANGUAGE sql VOLATILE;

-- ── Tags ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pp_tags (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The unguessable half of /walk/<token>. Rotatable: UPDATE it and every
  -- printed QR for this tag dies at once. That is the point — a sticker walks
  -- out of the shop on somebody's laptop lid and you re-print rather than
  -- re-plumb.
  token        text NOT NULL UNIQUE DEFAULT pp_tag_token(),

  -- What the sticker says, so the scan page can confirm you scanned the right
  -- one before anybody starts talking: "Test bay", "Unit 4153".
  label        text NOT NULL,

  -- ⚠️ NULL vs set is the whole distinction between the two kinds of sticker,
  -- and both are wanted:
  --   NULL  — a STANDING tag, printed once and taped to the test bay wall. The
  --           scanner types the four digits. Survives every unit forever.
  --   set   — a UNIT tag, printed with the job and stuck to that machine. The
  --           scanner types nothing, which on a shop floor is the difference
  --           between a walk happening and not happening.
  -- A unit tag is not an FK to eng_jobs for the same reason pp_walkarounds.job_id
  -- is nullable: the number is what the shop says out loud, and a sticker must
  -- print whether or not anybody has opened a job record yet.
  job_number   text,

  is_active    boolean NOT NULL DEFAULT true,
  notes        text,

  created_by   uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- Belt to the mint's suspenders: a mint that silently returned '' or a short
  -- string would hand out a guessable link and nothing else would complain.
  CONSTRAINT pp_tags_token_chk CHECK (token ~ '^[A-Za-z0-9_-]{43}$')
);
-- No index on token — the UNIQUE constraint already builds the btree the
-- /walk/<token> lookup rides on. (050 and 055 decline the same redundant index.)

CREATE INDEX IF NOT EXISTS pp_tags_active_idx ON pp_tags (is_active, created_at DESC);

ALTER TABLE pp_tags ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — see the SECURITY note above.

-- ── Walkarounds learn where they came from ───────────────────────────────────

-- 'portal' — somebody signed in and pressed "Walk a unit".
-- 'tag'    — somebody scanned a sticker. walked_by is NULL and walked_by_name is
--            SELF-DECLARED, so every screen that shows it says so.
ALTER TABLE pp_walkarounds
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'portal'
    CHECK (source IN ('portal', 'tag'));

ALTER TABLE pp_walkarounds
  ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES pp_tags(id) ON DELETE SET NULL;

-- ⚠️ THE POINT OF THE WHOLE FEATURE, as a column.
--
-- The meeting did not ask for "more submitters", it asked for four PERSPECTIVES
-- on one unit: the engineer, the person who built it, the electrician who wired
-- it, the person who tested it. Without this, twelve findings on job 4153 are an
-- undifferentiated list; with it, they are a build review — and "the person who
-- wired it and the person who tested it both flagged the same access panel" is a
-- sentence the data can now support.
--
-- Nullable because a portal walk by an engineer does not have to answer it.
ALTER TABLE pp_walkarounds
  ADD COLUMN IF NOT EXISTS walked_by_role text
    CHECK (walked_by_role IN ('engineering', 'built_it', 'wired_it', 'tested_it', 'other'));

CREATE INDEX IF NOT EXISTS pp_walkarounds_tag_idx ON pp_walkarounds (tag_id, status);

-- ── unit_serial goes away ────────────────────────────────────────────────────
--
-- 098 collected the four-digit job number AND a separate optional nameplate
-- serial, because the transcript mentions both and it was not clear from the
-- room whether they were two numbers.
--
-- Confirmed with Jacob 2026-08-27: they are the SAME number. The four digits the
-- shop says out loud ARE the serial. So the second field was asking people
-- standing at a unit to type a number they had already typed, which is exactly
-- the kind of friction that stops a capture surface being opened.
--
-- Safe to drop rather than deprecate: verified 0 rows in pp_walkarounds at the
-- time this was written, so nothing is being discarded. The number still lives
-- in `job_number`, which is also what joins to eng_jobs.job_number — keeping
-- that column name means the join reads the way it works, and the UI simply
-- calls it what the shop calls it.
ALTER TABLE pp_walkarounds DROP COLUMN IF EXISTS unit_serial;

COMMENT ON COLUMN pp_walkarounds.job_number IS
  'The four digits the shop says out loud. This is the unit SERIAL number and the job number — they are the same number (confirmed 2026-08-27). Joins to eng_jobs.job_number when a job record exists.';
