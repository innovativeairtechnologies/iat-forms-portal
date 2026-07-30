# Marketing Calendar

The content calendar for **social posts, email campaigns, blog articles, trade shows and paid
ads** — what's going out, on what channel, on what day, and who owns it.

- **Page:** `/admin/marketing` (Marketing nav group → Calendar). Perm `marketing_calendar`,
  seeded to the **marketing** role (+ admin implicitly) by migration `071_marketing_calendar.sql`.
- **Table:** `marketing_events` — RLS on with no policies, so it is service-role only; every
  read/write goes through the app.
- **API:** `POST /api/admin/marketing/events`, `PATCH|DELETE /api/admin/marketing/events/[id]`,
  all behind `requireMarketingAuth()`.

---

## The layout: three quarters grid, one quarter panel

The page is a two-column grid — `lg:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]`. At the 1280px
content width that measures **exactly 75% / 25%**; below roughly 1200px the panel stops shrinking
at its 300px floor and takes a slightly larger share rather than becoming an unusable form. Under
`lg` the two stack, calendar first.

The right column is a **floating card, not a drawer.** It looks like `components/ui/Drawer` (inset
`rounded-2xl` surface, hairline border) but it is deliberately none of the things that make a
drawer a drawer — no scrim, no focus trap, no body-scroll lock — because every one of those would
black out the calendar you are scheduling against. Same reasoning as `RepDetail` on
`/admin/territories`. It differs from that one too: this panel sits **in the grid as a real
column** instead of overlaying a map, so it carries no shadow (DESIGN.md §5 — cards are Level 1;
promote the border, never a resting shadow).

## Equal height, and why the panel has no scrollbar

At `lg` **nothing on this page scrolls.** The viewport height (`100dvh` minus the `h-14`
AdminTopBar) flows down unbroken to the calendar's week rows, which absorb the slack
(`repeat(N, minmax(112px, 1fr))` instead of a fixed row height). The grid's default `stretch`
then makes the panel column exactly as tall as the calendar column, and the panel takes
`lg:h-full` against it.

That definite height is the whole trick: because the panel knows how tall it is, it can drop its
own scrollbar (`lg:overflow-hidden` on the body) and use a **tab strip** instead. Eight form
fields do not fit a panel sized to a month grid — "Basics" (5) and "Details" (2) each do, on any
viewport tall enough to show the calendar at all. Tabs come from `components/ui/Tabs`, so the
strip matches the deals drawer.

Measured at 1440×900: both columns 796px, panel body overflow **0px** on both tabs.

**When something has to give, it's the calendar, not the panel.** Below the 112px row floor the
grid body scrolls; the panel never does. 112px is a FULL cell — date row + three chips + the
"+N more" line. Sizing the floor to the chips alone (96px) clips exactly that overflow hint,
which is the one thing telling you the day has more on it than you can see.

Two regions keep an `overflow-y-auto` as a safety valve — the day list and a record's notes —
because their length is genuinely unbounded, and silently clipping an event or a paragraph is
worse than a scrollbar. Both are sized so real use never reaches it (the day list fits ~14 rows
at ~44px each).

Every height constraint is `lg:`-prefixed. Below `lg` the columns stack, the page scrolls
normally, and the panel is natural-height.

## The panel has three modes, and composing is the resting state

| Mode | Entered by | Shows | Tabs |
|---|---|---|---|
| `compose` | default, and after any add/delete | The new-event form | Basics · Details |
| `day` | clicking a day cell | Everything on that day + "Add to this day" | — |
| `event` | clicking a chip | The record, inline edit, one-click status, delete | Details · Notes |

**Basics** is title, date, status, channel, platform and owner — the what/when/who. **Details**
is link and notes, with the notes box absorbing whatever height is left so it's a real writing
area rather than a stub. Owner sits on Basics deliberately: it's the "who's making it" half of
the same question, and it evens out two panes that were otherwise badly lopsided. The tab shows
a count of filled optional fields so they can't hide.

Title lives on Basics, so submitting from the Details tab with no title **switches you back to
Basics and focuses the field** rather than leaving a mysteriously disabled button.

Compose is the **resting** state on purpose: "put something on the calendar" is the job this page
exists for, so it is always already open — never behind a modal or a button. After a successful
add the form clears its title but **keeps the date, channel and owner**, because scheduling a week
of posts is a run of adds, not one-and-done.

Saving an event whose date is outside the visible month **moves the grid to that month**. A write
you can't see reads as a write that didn't happen.

## Chips are coloured by channel, not status

Channel is the axis you scan a content calendar on ("what's going out this week?"), so it owns the
colour. Status only marks the chip where it changes how you read the row — `published` gets a ✓,
`cancelled` goes struck-through and dimmed. Full status shows as a pill in the panel.

Both taxonomies live in **`lib/marketing.ts`** and nowhere else:

- **Channels:** social (violet) · email (sky) · blog (amber) · event (emerald) · ad (rose) ·
  pr (slate) · other (slate)
- **Statuses:** planned → drafting → scheduled → published, plus cancelled
- **Platforms** (social only): LinkedIn · Facebook · Instagram · YouTube · X · Other

### Why there's no CHECK constraint on them

The columns are plain `text`. Adding "TikTok" or "Podcast" should be a one-line TS edit, not a
migration and a deploy. The trade is that **`app/api/admin/marketing/validate.ts` is the only
enforcement** — it rejects anything outside the lists above, and it is the only writer (RLS denies
everyone else). The UI falls back to the neutral slate tone for a value it doesn't recognise, so a
row written by some future path still renders instead of going blank.

## Things that will bite you

**`platform` only means something on a social post.** It is always written *together with*
`channel` so that changing an event from Social to Email clears a stale "LinkedIn" in the same
statement. A PATCH carrying `platform` without `channel` is **rejected**, not silently stored.

**`link` is rendered as an `<a href>`, so its scheme is a security boundary** — a `javascript:`
value there would be stored XSS on click. `parseLink` accepts http(s) only, and promotes a bare
`buffer.com/x` (what people actually paste) to `https://`; left alone it would resolve as a
relative portal path.

**Dates are bare `YYYY-MM-DD`.** Parse them with `parseDay()` (local midnight) and format them
with `dayKey()` — `new Date('2026-08-12')` parses as *UTC* midnight and renders as the 11th for
anyone west of Greenwich, and `toISOString()` has the mirror bug on the way out.

**The page gates `now`/`cursor` behind a mounted effect.** The server renders in UTC; without the
guard it can disagree with the browser about which day is "today" and hydration mismatches. Same
guard the CRM calendar carries.

**Day cells contain buttons, so the cell itself isn't one.** Each cell is a plain div with a
full-bleed underlay `<button>` for "select this day", and a `pointer-events-none` content layer
above it whose chips opt back in individually. Nesting a chip button inside a cell button is
invalid HTML and breaks keyboard nav — don't "simplify" it back.

## Writes are awaited, not optimistic

Unlike the CRM calendar (`app/admin/deals/CalendarView.tsx`), every write here awaits the server
and applies the returned row. The CRM board is a high-frequency surface where temp-id
reconciliation earns its complexity; this is a handful of writes a week. Awaiting means state is
always the server's row — no temp ids, no revert paths, and no way for a failed write to leave a
phantom chip on the grid.

## Not the CRM calendar

`/admin/deals` → Calendar is a different thing on a different table (`deal_follow_ups`) with a
different audience. It was **not** reused: its rows `CASCADE` when DryWare prunes a deal, which
would silently delete marketing work that has nothing to do with a deal.

## Related

- `docs/deals.md` — the CRM calendar this borrows its grid shape from
- `docs/roles-and-permissions.md` — the perm matrix and the seed-drift gate
- `DESIGN.md` §2.4 (tones), §5 (elevation), §6 (inputs, cards)
