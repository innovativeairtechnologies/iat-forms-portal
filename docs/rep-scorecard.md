# Rep Scorecard (`/admin/rep-scorecard`)

Sales' rep-health review: ten 0/1/2 signals per rep summing to a **Total out of
20**, which sets a **Tier** and a **Grade**, rolled up automatically per firm and
across the whole channel. Ported from the `IAT_Rep_Scorecard` workbook Sales was
keeping by hand. Shipped 2026-08-03 (migration 075).

## What changed vs the workbook

The scoring model is **identical** — same ten signals, same wording, same bands —
so numbers Sales already trusts don't move. What the portal adds:

- **One shared copy.** No emailing a version around; the firm rollup and summary
  are computed, not re-linked.
- **Scores are kept per period** (`2026-Q3`). The workbook is a snapshot that
  gets overwritten; here a rep's Trend tab shows every quarter scored, with the
  quarter-over-quarter delta.
- **Reps are the real CRM roster**, not a typed name — see below.
- **Open pipeline and RFQ counts can come from DryWare** instead of being typed.
- **Every save is audit-logged** (`rep_scorecard.*`), with who scored and when
  shown on the record.

## Who can see / edit

- **View**: anyone holding the `deals` permission (Sales + admin by default) —
  the page shares the perm with the CRM / Performance / Territory pages via its
  own `ADMIN_PATH_PERMS` entry in `lib/roles.ts`, so **no new permission was
  seeded** and the `check-perm-seed` prebuild gate stays quiet.
- **Score / add / edit / remove reps**: **admin and sales roles only** — enforced
  server-side by `requireRepScorecardAuth({ write: true })` (`lib/api-auth.ts`).
  Another scoped role granted `deals` later sees the board read-only.

## Data model (migration 075 — extends the CRM layer, 062)

Reps are **`contacts` at a `kind='rep_firm'` company** — the *same roster the
territory map uses*, deliberately. The workbook's firm dropdown and the map's
firm list are the same ~30 firms; a rep added on either surface shows up on the
other rather than drifting into a second list.

- **`contacts.territory`** — the rep's region as free text ("Ohio Valley").
  Distinct from `company_territories`: that's the painted state/county set a
  **firm** owns; this is the patch a **person** covers.
- **`contacts.rep_status`** — `Active` | `Developing` | `Dormant` |
  `House/Direct` (the workbook's column-E dropdown). Named `rep_status`, not
  `status`, because `contacts` is the shared CRM table.
- **`rep_scorecards`** — one row per `(contact_id, period)`, unique-indexed;
  the drawer's save is an upsert on that index, so two people scoring the same
  rep in the same quarter land on one row.
  - The ten signals are `smallint` 0–2 and **nullable**. NULL means *not scored
    yet*, which is genuinely different from a 0 (*no*) — that's why the total is
    blank until at least one signal is set.
  - Hard numbers (`annual_goal`, `booked_ytd`, `open_pipeline`, `rfqs_60d`,
    `hit_rate`) are optional context. `hit_rate` is stored as a **fraction**
    (`0.40` = 40%), matching the workbook's cell format; the UI takes a percent
    and converts.
  - `numeric` columns arrive from PostgREST as **strings** — always read them
    through `num()` in `lib/rep-scorecard.ts`.

**Total, Score %, Tier and Grade are not stored.** They're pure functions of the
ten signals, living in `lib/rep-scorecard.ts`, so re-banding is one edit instead
of a backfill.

Internal data: RLS on, **no policies** — service-role only, same posture as 062
and 068.

## The bands (from the workbook's "Inside Sales Playbook, Measure")

| Total | Tier | What it means |
|---|---|---|
| 15–20 | Platinum / Gold | Invest and grow |
| 8–14 | Silver | Targeted coaching |
| 0–7 | Developing / At-risk | Rebuild the basics |

| Total | 17–20 | 13–16 | 9–12 | 5–8 | 0–4 |
|---|---|---|---|---|---|
| Grade | A | B | C | D | F |

A **firm's** tier and grade come from the same bands applied to its reps'
**average** total (scored reps only), exactly as the workbook's rollup does.

### The one thing to know about partial scoring

The workbook's Total is `SUM` of whatever is filled in, always out of 20 — so a
rep judged on three signals reads "Developing / At-risk" identically to one
judged on all ten. That behavior is kept (moving it would change every number),
but the UI now carries the **scored count** beside the total (`4/10`) and warns
in the drawer header, so a low score that just means "we haven't looked yet" is
legible instead of misleading.

## The DryWare assist

IAT sells *through* reps, so on a DryWare quote the rep is the person in
`contact` — which materializes onto **`deals.rep_contact`** (see
`lib/dryware-deals.ts`). ~305 of 372 live deals carry one. `lib/rep-pipeline.ts`
buckets those into per-rep open pipeline, total quotes, quotes in the last 60
days, and last-quoted date.

That powers two things:

1. **Numbers tab → "From DryWare"** — the live figures with a *Use these
   figures* button that fills Open pipeline + RFQs (60d).
2. **Add rep → name autocomplete** — every rep name already quoting, busiest
   first.

> ⚠️ **Matched on the rep's NAME**, not an id — `deals.rep_contact` is free text
> from DryWare with no FK to `contacts`. So it is a **suggestion, never an
> authority**: nothing is written until a human clicks the button, and what gets
> saved is what they accepted. Two reps sharing a name would collide (a lopsided
> figure is the tell), and a typo'd name silently matches nothing — which is why
> the autocomplete exists. Not every `rep_contact` is a rep, either; some quotes
> name an end customer's contact. Harmless for lookups, and the reason candidates
> are *offered* rather than bulk-imported into the roster.

"Open" is every mirrored deal: the feed carries only live projected sales (all
`stage='quoted'`, no won/lost). **If a won/lost signal ever lands on `deals`,
filter it in `repPipelineByName()`** — the scorecard reads pipeline as "still
winnable".

## Using it

- **Period** — the quarter picker in the card head. It's a URL param
  (`?period=2026-Q3`), so a review is linkable and survives a refresh. The last 8
  quarters are offered, plus any period already scored.
- **Add a rep** — pick the firm, then type the name (DryWare names autocomplete).
  Title, territory and status are optional.
- **Score** — click a rep → **Score** tab → tap 0 / 1 / 2 per signal. **Tapping
  the active value again clears it back to unscored.** The header total, tier and
  grade update live; nothing is written until *Save*.
- **Numbers** — goal / booked / pipeline / RFQs / hit rate, with % to goal and
  coverage derived beneath (coverage = pipeline ÷ the remaining gap to goal;
  "Goal met" once booked ≥ goal).
- **Trend** — every scored period for this rep with the delta between them.
- **Firms tab** — the rollup. Clicking a firm filters the Reps tab to it.

The drawer refuses to close on Esc or a scrim click while there are unsaved
edits (`dismissable={false}`), so a half-scored review can't be lost by a stray
click.

## Files

| Path | Role |
|---|---|
| `supabase/migrations/075_rep_scorecard.sql` | Schema |
| `lib/rep-scorecard.ts` | Signals, bands, scoring, rollups, formatting (pure, no deps) |
| `lib/rep-pipeline.ts` | DryWare-derived per-rep pipeline (server-only) |
| `app/admin/rep-scorecard/page.tsx` | Server page — loads roster, all periods, pipeline |
| `app/admin/rep-scorecard/RepScorecardClient.tsx` | Reps + Firms tabs, filters, stat strip |
| `app/admin/rep-scorecard/ScoreDrawer.tsx` | Score / Numbers / Trend record panel |
| `app/admin/rep-scorecard/AddRepDialog.tsx` | Add-a-rep modal with DryWare autocomplete |
| `app/api/admin/rep-scorecard/scores/route.ts` | `PUT` upsert a scorecard |
| `app/api/admin/rep-scorecard/reps/route.ts` | `POST` create a rep |
| `app/api/admin/rep-scorecard/reps/[id]/route.ts` | `PATCH` / `DELETE` a rep |
| `app/api/admin/rep-scorecard/validate.ts` | Field validation (clean 400s) |

## Open / deferred

- **The roster starts empty.** The source workbook was a blank template (only its
  EXAMPLE row was filled), so there was nothing to import — Sales builds the
  roster as they review, with DryWare autocomplete doing the typing.
- **Goals and booked-YTD are manual.** DryWare carries no goal and no won/lost
  signal, so there is nothing to derive them from. If a booked figure ever lands
  in the feed, `booked_to_plan` and `% to goal` are the two places to wire it.
- **No per-rep email/reminder.** Reviews are done in the room; a "score due"
  nudge is a candidate for the automation roadmap.
- Removing a rep cascades away their whole scoring history (`ON DELETE CASCADE`).
  The UI confirms and names the period count first; there is no undo.
