-- ─────────────────────────────────────────────────────────────────────────────
-- 098_post_production.sql — Post-Production walkarounds.
--
-- The meeting this replaces (2026-08-24, "Post production initial discussion")
-- described a process that already existed and already failed. A unit goes into
-- test, gets released to shipment, and the team walks it — engineer, the person
-- who built it, the electrician who wired it, the tester. Somebody wrote the
-- findings down and put them in a spreadsheet. In the words of the transcript,
-- that spreadsheet "went off to die": hundreds of opportunities, no owner, no
-- clock, nothing closed.
--
-- So the capture surface is the easy half and is NOT the point. The point is the
-- three things the spreadsheet could not do:
--
--   1. ASSIGN IT.      A finding has an owner and a due date, exactly like a
--                      service ticket. "It needs to be responded to within two
--                      weeks on what the solution is."
--   2. NOTICE REPEATS. "Use AI to determine has this issue been identified
--                      before… guys, we've brought these up twelve times."
--                      pp_themes is that. The COUNT is SQL; the judgement about
--                      whether two findings are the same issue is the only part
--                      a model touches.
--   3. FEED IT FORWARD. "All those issues are automatically carried over to the
--                      next pre-production meeting… that might be a checklist."
--                      pp_preflights + pp_preflight_items.
--
-- ── Why a walkaround AND a finding ──────────────────────────────────────────
-- "Maybe I'll fill one out, Devin might fill one out. So there might be two
-- underneath the same job, which is fine." A walkaround is one person's lap of
-- one unit; a finding is one observation. Two people walking job 4153 produce
-- two walkarounds and any number of findings, and neither overwrites the other.
--
-- The walkaround also gives the phone something to hold onto. Capture happens on
-- a shop floor with bad signal, so the row is created the moment the job number
-- is entered and every photo, clip and sentence is saved against it as it
-- happens. A dropped connection loses the last action, never the walk.
--
-- ── Why job_id is nullable ──────────────────────────────────────────────────
-- Same reasoning as eng_tasks (096). The job number is what everyone says out
-- loud ("4153") and it is what gets typed at the unit. If a matching eng_jobs
-- row exists we link it and inherit the customer and model; if it does not, the
-- walk still happens. A capture surface that can refuse to capture is a capture
-- surface people stop opening. The transcript is explicit about the nameplate
-- too — "sometimes it might not be on there yet" — which is why unit_serial is
-- separate from job_number and optional.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Themes ───────────────────────────────────────────────────────────────────
-- The recurring issue behind N findings. Created first because findings point at
-- it.
--
-- ⚠️ THERE IS NO COUNT COLUMN, deliberately. "This has been raised twelve times"
-- is the sentence the whole feature exists to be able to say, and a
-- denormalised counter that drifts by one turns it into a sentence nobody
-- trusts. Every count in the UI is a live COUNT(*) over pp_findings.
CREATE TABLE IF NOT EXISTS pp_themes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  summary       text,
  category      text NOT NULL DEFAULT 'other',

  -- 'open'     — still happening, still carried into pre-production
  -- 'resolved' — engineering changed something; stops being carried forward,
  --              but a NEW finding landing on it reopens it (see the API).
  -- 'accepted' — a known trade-off nobody intends to change. Kept visible so it
  --              stops being re-raised, but it does not nag.
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved', 'accepted')),
  resolution    text,
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES employees(id) ON DELETE SET NULL,

  created_by    uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_themes_status_idx ON pp_themes (status);

-- ── Walkarounds ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pp_walkarounds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The four-digit shop number, typed at the unit. Not unique: two people walk
  -- the same job, and the same job can be walked again after a rework.
  job_number     text NOT NULL,
  job_id         uuid REFERENCES eng_jobs(id) ON DELETE SET NULL,

  -- Off the nameplate, when the nameplate is on yet. Never required.
  unit_serial    text,

  -- Snapshots, not joins — same reasoning as eng_jobs' customer_name. A walk is
  -- a record of what was in front of somebody on a day; renaming a customer two
  -- years later must not rewrite it.
  customer_name  text NOT NULL DEFAULT '',
  model_number   text,

  walked_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  walked_by_name text NOT NULL DEFAULT '',

  -- 'walking'   — in progress on somebody's phone. Findings are NOT in the queue
  --               yet and carry no due date; an abandoned walk nags nobody.
  -- 'submitted' — handed to engineering. This is the transition that stamps
  --               every finding's two-week clock.
  status         text NOT NULL DEFAULT 'walking'
                   CHECK (status IN ('walking', 'submitted')),

  notes          text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  submitted_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_walkarounds_job_idx     ON pp_walkarounds (job_number);
CREATE INDEX IF NOT EXISTS pp_walkarounds_status_idx  ON pp_walkarounds (status, started_at DESC);
CREATE INDEX IF NOT EXISTS pp_walkarounds_walker_idx  ON pp_walkarounds (walked_by, started_at DESC);

-- ── Findings ─────────────────────────────────────────────────────────────────
-- The accountable unit. Everything else on this page exists to make these get
-- answered.
CREATE TABLE IF NOT EXISTS pp_findings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  walkaround_id  uuid NOT NULL REFERENCES pp_walkarounds(id) ON DELETE CASCADE,

  -- Denormalised from the walkaround so the queue, the themes board and the
  -- reminder sweep can all read a finding without a join. Set by the API on
  -- insert and never edited independently.
  job_number     text NOT NULL,
  job_id         uuid REFERENCES eng_jobs(id) ON DELETE SET NULL,

  -- 1-based within the walk, so a finding can be referred to out loud as
  -- "4153, number three" while standing next to the unit.
  seq            integer NOT NULL DEFAULT 1,

  note           text NOT NULL DEFAULT '',

  -- ⚠️ WHERE THE WORDS CAME FROM, kept honestly. A dictated sentence is a
  -- machine's guess at what somebody said and it will sometimes be wrong in a
  -- way that reads perfectly fluently ("reactor" for "react air"). The detail
  -- page labels a dictated note as dictated and keeps the audio beside it, so an
  -- engineer arguing with a finding can listen to it rather than trusting the
  -- transcript. Never collapse this to a boolean or drop it because the text
  -- "looks fine".
  note_source    text NOT NULL DEFAULT 'typed'
                   CHECK (note_source IN ('typed', 'dictated', 'transcribed', 'mixed')),

  category       text NOT NULL DEFAULT 'other',

  -- The transcript's own register: most of what gets raised on a walk is a
  -- "little thing". Forcing every observation to look like a defect is how the
  -- old spreadsheet got to hundreds of rows nobody could triage.
  severity       text NOT NULL DEFAULT 'should_fix'
                   CHECK (severity IN ('nit', 'should_fix', 'must_fix')),

  -- [{ kind: 'photo'|'video'|'audio', path, mime, bytes, duration_ms? }]
  -- Storage PATHS in the private post-production bucket, never URLs — a URL in a
  -- column is a URL that expires. Signed on read, like crib-photos.
  media          jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 'draft'     — still on the phone, part of an unsubmitted walk.
  -- 'open'      — submitted, nobody owns it yet.
  -- 'assigned'  — an engineer owns it and the two-week clock is running.
  -- 'answered'  — a solution has been written. NOT closed: the person who raised
  --               it accepts or reopens.
  -- 'closed'    — accepted.
  -- 'duplicate' — the same thing as another finding; folded into a theme.
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'open', 'assigned', 'answered', 'closed', 'duplicate')),

  assignee_id    uuid REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at    timestamptz,

  -- Submitted date + the playbook's response window. NULL while the finding is a
  -- draft, because a clock that starts before anybody has been told is a clock
  -- that only ever produces unfair red.
  due_date       date,

  resolution     text,
  resolved_by    uuid REFERENCES employees(id) ON DELETE SET NULL,
  resolved_at    timestamptz,

  theme_id       uuid REFERENCES pp_themes(id) ON DELETE SET NULL,

  -- ⚠️ HOW THE THEME LINK WAS MADE, and it matters as much as the link.
  -- 'ai' means a model matched it and no human has looked; the UI shows those as
  -- suggestions with a one-tap confirm or unlink. 'human' means somebody agreed.
  -- Leadership counts ("raised twelve times") are reported over CONFIRMED links
  -- with the unconfirmed count shown separately, so the headline number is never
  -- something a model decided on its own.
  theme_source   text CHECK (theme_source IN ('ai', 'human')),
  theme_note     text,   -- the model's one-line reason, kept for the human review

  -- Chase bookkeeping, same mechanism as eng_tasks (096): stamped when mail goes
  -- out, cleared on reassignment. ⚠️ A stamp is a CLAIM that a send did not
  -- throw. It is not evidence anybody read anything.
  nudged_at      timestamptz,
  escalated_at   timestamptz,

  created_by     uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Recurrence retrieval. Generated so nothing has to remember to maintain it;
  -- the two-arg to_tsvector(regconfig, text) form is IMMUTABLE, which is what
  -- makes a STORED generated column legal (same trick as kb_chunks in 030).
  tsv            tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(note, ''))) STORED
);

CREATE INDEX IF NOT EXISTS pp_findings_walk_idx    ON pp_findings (walkaround_id, seq);
CREATE INDEX IF NOT EXISTS pp_findings_status_idx  ON pp_findings (status, due_date NULLS LAST);
CREATE INDEX IF NOT EXISTS pp_findings_assignee_idx ON pp_findings (assignee_id, status);
CREATE INDEX IF NOT EXISTS pp_findings_theme_idx   ON pp_findings (theme_id);
CREATE INDEX IF NOT EXISTS pp_findings_job_idx     ON pp_findings (job_number);
CREATE INDEX IF NOT EXISTS pp_findings_tsv_idx     ON pp_findings USING GIN (tsv);

-- ── Pre-production checks ────────────────────────────────────────────────────
-- "Let's click on pre-production meeting. Does it have this issue? Nope, I
-- resolved that." One row per job kickoff; one item per theme carried in.
CREATE TABLE IF NOT EXISTS pp_preflights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number   text NOT NULL,
  job_id       uuid REFERENCES eng_jobs(id) ON DELETE SET NULL,
  held_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  held_by_name text NOT NULL DEFAULT '',
  notes        text,
  status       text NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'complete')),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_preflights_job_idx ON pp_preflights (job_number, created_at DESC);

CREATE TABLE IF NOT EXISTS pp_preflight_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preflight_id  uuid NOT NULL REFERENCES pp_preflights(id) ON DELETE CASCADE,
  theme_id      uuid REFERENCES pp_themes(id) ON DELETE CASCADE,

  -- The theme's title AT THE TIME the check was held. A pre-production record is
  -- a record of a conversation; re-titling a theme next year must not silently
  -- rewrite what the room agreed to.
  title         text NOT NULL,

  -- 'pending'    — carried in, not yet discussed
  -- 'addressed'  — designed around on this job
  -- 'not_applicable' — this job cannot hit it (different configuration)
  -- 'risk'       — known, accepted, watch it. Deliberately available, because a
  --                checklist with no honest "we did not fix this" option becomes
  --                a checklist everybody ticks.
  verdict       text NOT NULL DEFAULT 'pending'
                  CHECK (verdict IN ('pending', 'addressed', 'not_applicable', 'risk')),
  note          text,
  checked_by    uuid REFERENCES employees(id) ON DELETE SET NULL,
  checked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pp_preflight_items_pf_idx    ON pp_preflight_items (preflight_id);
CREATE INDEX IF NOT EXISTS pp_preflight_items_theme_idx ON pp_preflight_items (theme_id);

-- One row per theme per check — re-running the generator must top up, not
-- duplicate. Matches the ON CONFLICT the API uses.
CREATE UNIQUE INDEX IF NOT EXISTS pp_preflight_items_unique_idx
  ON pp_preflight_items (preflight_id, theme_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Service-role only, like eng_jobs/eng_tasks: every read and write goes through
-- an API route behind requireEngineeringAuth. No policies is the policy.
ALTER TABLE pp_themes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_walkarounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_findings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_preflights      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pp_preflight_items ENABLE ROW LEVEL SECURITY;

-- ── match_pp_findings() — "have we said this before?" ────────────────────────
-- Candidate retrieval for recurrence detection, same IDF-weighted shape as
-- match_kb_chunks (030) and for the same reason: requiring every term (AND)
-- matches nothing, while any-term (OR) lets "the" and "unit" drag in the whole
-- table. Score each prior finding by the summed inverse-document-frequency of
-- the distinct query terms it contains, so "laminar" and "reactivation" outweigh
-- "gap" and "little".
--
-- This function RETRIEVES. It does not decide. A model reads the shortlist and
-- says whether any of them is genuinely the same issue, and a human confirms
-- that. Keeping the two apart is what stops "twelve times" from being twelve
-- coincidences of the word "filter".
CREATE OR REPLACE FUNCTION match_pp_findings(
  query_text  text,
  exclude_id  uuid DEFAULT NULL,
  match_limit integer DEFAULT 8
)
RETURNS TABLE (
  finding_id  uuid,
  job_number  text,
  note        text,
  category    text,
  severity    text,
  status      text,
  theme_id    uuid,
  created_at  timestamptz,
  rank        real
)
LANGUAGE sql STABLE
SET search_path = public      -- explicit + schema-qualified, per the 030 precedent
AS $$
  WITH ql AS (
    SELECT tsvector_to_array(to_tsvector('english', query_text)) AS lex
  ),
  pool AS (
    SELECT count(*)::numeric AS n FROM public.pp_findings WHERE status <> 'draft'
  ),
  terms AS (
    SELECT lexeme,
           plainto_tsquery('english', lexeme) AS tq,
           (SELECT count(*)
              FROM public.pp_findings f2
             WHERE f2.status <> 'draft'
               AND f2.tsv @@ plainto_tsquery('english', lexeme)) AS df
    FROM ql, unnest(ql.lex) AS lexeme
  ),
  scored AS (
    SELECT f.id,
           sum( ln((p.n + 1.0) / (t.df + 1.0)) + 0.1 ) AS score
    FROM terms t
    CROSS JOIN pool p
    JOIN public.pp_findings f ON f.tsv @@ t.tq
    WHERE t.df > 0
      AND f.status <> 'draft'
      AND (exclude_id IS NULL OR f.id <> exclude_id)
    GROUP BY f.id
  )
  SELECT f.id, f.job_number, f.note, f.category, f.severity, f.status,
         f.theme_id, f.created_at, s.score::real
  FROM scored s
  JOIN public.pp_findings f ON f.id = s.id
  ORDER BY s.score DESC, f.created_at DESC
  LIMIT match_limit;
$$;

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Private. Photos, video clips and voice notes off a phone, uploaded DIRECTLY
-- from the browser with a service-role-minted signed upload URL — a Vercel
-- function caps its request body at ~4.5MB and a single phone photo clears that,
-- never mind a video. No storage policies: the signed token authorises the
-- write, and reads go through an admin-gated route that 307s to a short-lived
-- signed URL (same shape as crib-photos in 050).
--
-- ⚠️ 50MB is not an arbitrary number. Supabase's standard upload endpoint — the
-- one uploadToSignedUrl uses — is capped by the PROJECT's global upload limit,
-- which is 50MB unless it has been raised in the dashboard. Setting this bucket
-- higher than the global would silently do nothing and phone videos would fail
-- at the network layer with no useful message. The client refuses over-size
-- files up front and says how long a clip that is (~1 minute of 1080p).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('post-production', 'post-production', false, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;
