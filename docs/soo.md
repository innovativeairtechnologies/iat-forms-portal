# Sequence of Operation builder

**Route:** `/admin/soo` · **Perm:** `soo` (sales + engineering; approval = engineering or admin)
**Migration:** 084 · **Shipped:** 2026-08-07 (Phase 1)

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

### What the 2026-08-07 test unit taught us

The first hand-built test configuration (gas reactivation, DX pre-cooling, no rotor alarm package)
found three holes the Ferrara unit could not, because Ferrara happens to be fully covered. All
three are now permanent regression cases in `scripts/verify-soo.mjs`.

1. **The warning fired but did not print.** `uncovered` was computed correctly and shown in the
   editor, but `app/print/soo/[id]/page.tsx` never rendered it — so the PDF read as complete while
   missing its entire reactivation heat sequence. A safety net that stops at the screen is not a
   safety net. It now prints above the sequence, in red, on every draft that has a gap.
2. **Coverage was satisfiable by a one-line sensor entry.** The rule used to ask "did any clause
   testing this fact survive?", and the pre-cooling temperature-sensor line was enough to make a
   missing DX pre-cooling *sequence* look covered. `CoverageRule.covered` now names the clause that
   **is** the sequence. Keys pointing at clauses that don't exist yet (`react_heat_gas`,
   `pre_cooling_dx`) are the declared gaps — effectively a to-do list of what the master document
   still owes us.
3. **Nothing at all caught the wheel never starting.** Both wheel-start clauses required the rotor
   rotation alarm package, conflating *how the wheel starts* with *how its rotation is proven*.
   Starting and proving are now separate clauses.

The same review split the freeze-protection Stage 2 clauses into a lead-in plus one conditional
action per bullet. They previously named a pre-cooling valve, a post-cooling valve and a return-air
damper whether or not the unit had them — inside the safety sequence, which is the worst place for
it. This also removed the OA-only / OA+RA variant pairs: the dampers now gate themselves.

## Phase 2 — reading the submittal

Upload the DryWare PDF; the portal proposes a configuration and a human confirms it. **The extract
route writes no facts** — it returns a proposal, and the PATCH route is what commits. Re-running it
is free and changes nothing.

**Two readers, deliberately.** The deterministic parsers in `lib/soo-extract.ts` do most of the
work; a model call runs as a *redundant second reader* over the same filtered pages. That isn't
belt-and-braces: with one source a wrong fact is indistinguishable from a right one and the
reviewer has only a page citation, whereas with two the review table can mark a fact "Schedule +
model number agree" (skim) versus "only the second reader saw this" (read it). It also turns a
parser breakage into a visible pile of conflicts instead of a silent pile of nulls. `PRECEDENCE`
puts `llm` last — the model can add a fact or disagree loudly, never override.

**What the parsers know about the document** (all verified against the real 45-page file):

| Page kind | Handling |
|---|---|
| Schedule (4 pp) | Primary source. Parsed by matching **known label prefixes**, not by guessing where the label ends — an unrecognised line becomes a visible `unmapped` entry rather than a bad parse. |
| Component spec pages | `· Label - Value` bullets. The two-column layout puts several bullets on one text line, so the parser splits on the bullet glyph, not newlines. |
| Duct connections | Authoritative for OA / RA / react-outlet dampers. |
| Flow diagrams (2 pp) | **Images** — 37 words of text each. No fact may come from here. |
| Guide spec (13 pp) | **Dropped in code.** Generic boilerplate ("provide freezestat set at 35°F") for a hypothetical unit: plausible, authoritative-sounding, on-topic and wrong. Deleting the pages is verifiable; prompting a model to ignore thirteen pages of them is not. |
| Vendor cut sheets (8 pp) | Dropped. Ours vs theirs is decided by the **IAT footer**, not keywords — matching "New York Blower" would misfile our own Process Fan page, which names the manufacturer. |

**Refusing to guess is a feature.** The submittal says "BACnet" without stating MS/TP or IP, so
`bas_protocol` is left unset and reported for a human — a coin flip printed as fact in a controls
contract is worse than a blank. Same for the plenum pressure transmitters and wheel drive, which
the submittal never mentions: they stay null, their clauses block, and a person fills them in.

**The review table is ordered by blast radius**, never document order: conflicts → gating facts
(each annotated "N on · M off") → identity → design conditions → unrecognised lines. A flat
fifty-row table gets clicked through, and deterministic assembly then renders the wrong facts with
total confidence. Every human edit records `method: 'human'`, which outranks every reader.

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
was diffed against the real `IAT_Trane_Ferrara_Sequence_of_Operation.docx`: **100/110 paragraphs
exact-match**. Eight differences are hedges resolving to definite statements; two are the safety
splits described above (the wheel start/prove sentence, and the shutdown valve list). All ten are
intended. That fact object is also the ground truth for Phase 2's extractor.

## Phases

1. ✅ Library + assembler + manual facts + print view
2. ✅ Submittal extraction — deterministic parsers + model second reader + reconciliation, upload to `soo-submittals` (file **kept** as evidence), blast-radius review table
3. `.docx` export
4. Library editor UI + Point List / Instrument Index (the P&ID precursor — blocked on a tagging convention from engineering, not on tooling)

## Verification

- `node --import ./scripts/ts-resolve.mjs scripts/verify-soo.mjs` — 78 checks: assembler, three-valued
  predicates, coverage, constants (mutation-tested), overrides, approval gate, and the two regression
  units (Ferrara + the 2026-08-07 gas/DX unit).
- `node --import ./scripts/ts-resolve.mjs scripts/verify-soo-extract.mjs [--dump]` — 76 checks run
  against the **real** 45-page Ferrara PDF, asserting the extracted fact set equals the hand-entered
  one. Fixture-backed, not mocked: a DryWare layout change breaks it here rather than in production.
  Skips (loudly) if the PDF is missing rather than passing vacuously.
