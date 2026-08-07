# Sequence of Operation builder

**Route:** `/admin/soo` · **Perm:** `soo` (sales + engineering; approval = engineering or admin)
**Migration:** 084 · **Shipped:** 2026-08-06 (Phase 1)

Turns a unit configuration into the project Sequence of Operation — the controls narrative that
goes to the controls contractor and BAS integrator. Phase 1 is manual fact entry; Phase 2 adds
extraction from the DryWare Sales Submittal PDF.

## The design in one paragraph

**Assembly is deterministic — there is no AI in the path.** The master SOO lives as a clause
library (`lib/soo-master.ts`): ~100 clauses, each carrying a `requires` predicate over the unit's
configuration and `{{slot}}` bindings. Assembly evaluates predicates, fills slots, and returns the
included document **plus the excluded and blocked lists**. Every "(where provided)" hedge in the
old Word master became a predicate, and because one document = one unit, the generated sequence
states things outright instead of hedging.

## The three kinds of number

| Kind | Owner | Example | Behaviour |
|---|---|---|---|
| **Control constant** | `CONTROL_CONSTANTS` in `lib/soo.ts` | 120°F react permissive, 40°F freeze Stage 1, 300°F react ceiling | Identical on every project. Each carries a `rationale`. Editing a clause that renders one requires a note, enforced at approval. |
| **Design condition** | The submittal | 3,000 CFM process, 240°F react heat-to | Printed on the document; **never** allowed to gate a clause (`validateLibrary` rejects it). |
| **Project setpoint** | Neither — the mechanical spec / commissioning | Space dewpoint setpoint | Unset ⇒ renders a visible `[TBD at commissioning]` **and** blocks approval. Never silently defaulted. |

## Three-valued predicates (the core safety property)

A fact that is **null means unknown, not "no"**. An unknown fact **blocks** its clauses — they are
listed under "Unresolved" and the document cannot be approved — rather than silently excluding
them. A definitively non-matching fact **excludes** with a human-readable reason, and the excluded
list prints on the document ("Not applicable to this unit"), so a reader can always tell *not
applicable* from *nobody wrote this*. A `coverage` rule turns "the library has no gas reactivation
sequence" into a loud blocker instead of a document quietly missing its most important section.

## Files

- `lib/soo.ts` — types, assembler, validators, constants. Pure; exercised by `scripts/verify-soo.mjs` (66 checks incl. mutation tests).
- `lib/soo-master.ts` — the master clause library, decomposed from the Ferrara SOO. **Engineering content — treat edits like edits to the Word master.**
- `lib/soo-library.ts` — DB override (`soo_library`, single row) + fallback to code + **versioning** (`soo_library_versions`, append-only). Approval pins the version.
- `app/api/admin/soo/…` — list/create · get/patch/delete · `assemble` · `status`. All behind `requireSooAuth` (`lib/api-auth.ts`); ⚠️ `/api` is not in the middleware matcher, the guard is the only gate.
- `app/admin/soo/…` — list (`SooClient`) + editor (`SooEditor`). The configuration form is ordered by **blast radius**: gating facts first, each annotated "N on · M off".
- `app/print/soo/[id]` — print view; DRAFT banner until approved; footer carries document id + library version.

## Ladder

`draft → in_review → approved`, mirroring proposals. Approval re-runs `approvalBlockers()`
server-side: blocked clauses, unresolved extraction conflicts, unset required setpoints, un-noted
constant overrides, uncovered configurations. Reopening an approved document requires approver
authority.

## Acceptance test

`scripts/verify-soo.mjs` hand-enters the Ferrara facts (IAT-3000RS-IDP) and the generated document
was diffed against the real `IAT_Trane_Ferrara_Sequence_of_Operation.docx`: 102/110 paragraphs
exact-match; all 8 differences are hedges resolving to definite statements (intended). That fact
object is also the ground truth for Phase 2's extractor.

## Phases

1. ✅ Library + assembler + manual facts + print view (this)
2. Submittal PDF extraction (deterministic Schedule parser + LLM second reader + reconciliation; upload to `soo-submittals`, file **kept** as evidence)
3. `.docx` export + submittal upload UI
4. Library editor UI + Point List / Instrument Index (the P&ID precursor — blocked on a tagging convention from engineering, not on tooling)
