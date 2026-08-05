# Proposals

`/admin/proposals` — turn a Deal plus a Sizing Studio selection into a branded, submittal-ready
PDF that a human reviews and approves before it goes anywhere. **Draft, human sends.** Nothing is
emailed; the portal produces a file.

Migration `079_proposals.sql`. Perm `proposals`, seeded for **sales**.

---

## The one design decision everything follows

**Claude is never shown a number.**

A proposal is a higher-stakes document than a [case study](./case-studies.md) — a customer may read
it as a commitment. So the model writes only two sections, `cover_letter` and `scope`, from a FACTS
object containing **qualitative descriptors alone**: *"a high-capacity desiccant wheel"*,
*"electric reactivation"*, *"verified against the manufacturer's own wheel performance model"*.
Never `7.58 gr/lb`.

Every figure on the finished PDF is templated directly from the frozen sizing snapshot by
`lib/proposal-pdf.ts`, which never reads the prose.

That inversion is what makes the guard sound. The case-study tool lets the model write figures and
then checks them against the inputs, and that check has real holes:

- a decimal splits into two runs that both pass (`35.5` → `35` and `5`)
- single digits are permanently whitelisted, because `unit: 1..N` is in the corpus
- a model number donates its digits, so a fabricated `$5000` passes next to `IAT-5000`
- **it only runs at generate time**, so a figure a human types in afterwards is never checked

Here the rule is simply: **any digit Claude writes is a flag**, and it must be cleared by a human
before approval. `checkDigits()` re-runs on every save, not just at generate.

The allowlist is the model number and the customer/site/job names, matched as **whole tokens** and
removed intact before scanning — so `IAT-3000RE-2000` passes while a bare `$3000` still flags.

**The one hole, stated rather than papered over:** a number spelled as a word ("thirty percent").
The system prompt forbids it and a human reads the draft. `verify-proposals.mjs` asserts this
limitation explicitly so nobody later assumes it is covered.

---

## The snapshot

The Sizing Studio **persists nothing** — no table, no `localStorage`; the clipboard is the only way
a run leaves that page. So creating a proposal is the moment a selection first becomes durable, and
the `proposals` row is the only record of it.

Both `sizing_inputs` **and** `sizing_result` are stored. The inputs alone would replay the run
today (`calculateSizing` is pure and deterministic), but the engine will change and the catalog is
fetched live from DryWare — an approved proposal has to render the same numbers in a year.

`verification` holds the DryWare DesMod result (see [sizing-studio.md](./sizing-studio.md)). It is
what separates a **preliminary** proposal from an engineering one, and it is stamped on the PDF
either way.

⚠️ **An unverified proposal is likely to over-quote.** The local planning coefficients are
materially conservative — 15.56 vs 7.58 gr/lb on the default case — so an unverified selection may
name a larger unit, or a high-capacity wheel, than the job needs. The editor says so inline.

### Nothing customer-facing originates in a request body

The client may post sizing **inputs**; it may never post a sizing **result** or a **verification**.

- `POST /api/admin/proposals` recomputes the selection server-side against the live catalog.
- `POST /api/admin/proposals/[id]/verify` is the only thing that writes `verification`, and it does
  so by calling DryWare itself.

A forged unit or airflow therefore cannot come back looking authoritative.

---

## The ladder

`draft → in_review → approved`, with `reopen` from either back to draft.

**A watermarked draft PDF can be produced at any stage.** Approval is what lifts the
`DRAFT — NOT FOR DISTRIBUTION` watermark. Blocking the PDF outright would just be routed around
with screenshots; the watermark is the control that actually travels with the document.

Approval requires the **admin** role — deliberately narrower than case studies (marketing/admin).
It is not delegatable through the perm matrix: a scoped role granted `proposals` can draft, edit
and circulate a watermarked draft, but cannot clear the watermark. Enforced in
`requireProposalsAuth({ approve: true })`, and re-checked server-side in `status/route.ts`, which
re-runs `approvalBlockers()` rather than trusting the UI's copy.

Reopening an approved proposal **deletes the archived PDF**: once the document is reopened it no
longer represents anything approved, and a stale "approved PDF" is worse than none.

---

## The PDF

`lib/proposal-pdf.ts`, client-side jsPDF, letter, with a running header, hand-rolled column tables
and a page-x-of-y footer.

⚠️ **`lib/pdf.ts` is not a usable base** — it is one monolithic function rendering a form submission
as a label/value stack, on A4, with no tables, no logo, no running header, and a page-break
heuristic that estimates line count from string length. The real precedent is
`public/tools/washdown-load-calculator.html`. `jspdf-autotable` is **not** installed; tables are
built from `doc.text` at fixed x-offsets, as everywhere else in this repo.

The logo is **fetched** at render time rather than inlined as base64 — the standalone HTML tools
embed theirs because they are single-file artifacts, but a ~40KB literal here would sit in the
client bundle. A missing logo degrades silently rather than costing the user their document.

Only an **approved** PDF is archived, to the private `proposal-docs` bucket via the signed-upload
idiom (bytes go browser → Storage directly; a multi-megabyte body through a Vercel function would
hit the ~4.5MB cap). Reads are 1-hour signed URLs.

---

## Entry points

| From | What carries across |
|---|---|
| `/admin/proposals` → **New proposal** | nothing; fill it in by hand |
| A **Deal** → Proposals tab → **New proposal** | `deal_id`, plus a snapshot of the customer and job name |
| **Sizing Studio** → **Start a proposal** | the sizing **inputs**; the server recomputes the selection |

`deals.customer` is DryWare-owned and rewritten on every sync, so the customer name is **snapshotted**
onto the proposal rather than read live — otherwise the company name on an already-approved document
could change underneath it.

(Note the DryWare sync would not have clobbered a new column either: `drywareFields()` in
`lib/dryware-deals.ts` is an 11-column allowlist and the sync is an upsert, so everything else
survives. The separate table is for lifecycle reasons, not sync ones.)

---

## Verification

```bash
node --import ./scripts/ts-resolve.mjs scripts/verify-proposals.mjs
```

54 checks. The ones that matter:

- **FACTS carry no digit** outside the allowed identity tokens — asserted by masking the allowlist
  out of the serialized object and scanning what remains. If a figure ever leaks into what the model
  sees, this fails.
- Each hole in the case-study checker is reproduced as a test asserting **this** checker does not
  share it.
- The known spelled-out-number hole is asserted as a *known* hole, so it cannot be mistaken for
  coverage.
- **The PDF is actually rendered**, not just compiled: the draft must be measurably larger than the
  approved copy (the watermark is real content), long prose must paginate, and a proposal with no
  sizing selection must still produce a document.

> `lib/proposal-pdf.ts` accepts jsPDF's default **or** named export specifically so the suite can
> render a document under Node. That is the difference between a tested generator and the
> "compile-verified, never human-clicked" pattern several features in this repo carry.

---

## Not built yet

- **Pricing.** Deliberately out of scope for v1. DryWare exposes list prices and per-option labor
  hours, but that is not a quote engine — no options, freight or margin logic — and a figure nobody
  in sales signed off on landing in a customer's hands is a commercial problem, not a document one.
- **Sending.** Download only. Production email is on the `onboarding@resend.dev` sandbox and reaches
  only the Resend account owner, so a "send" button would silently not arrive.
- **A diagram on the proposal.** `/admin/diagram-studio` already produces application airflow
  figures; embedding one is the obvious next addition.
- **Human-clicked testing.** Compile-verified, 54 automated checks, and the PDF is rendered and
  inspected — but no signed-in person has driven the editor end to end.
