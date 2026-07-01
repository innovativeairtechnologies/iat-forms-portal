# Design language — calm first

The IAT Portal's visual baseline is **calm**. The layout, spacing, type scale,
and the shared card/list kit are already restrained and should stay that way.
The recurring failure mode is **decoration without meaning** — visual weight
that carries no information. This doc is the guardrail against re-introducing it.

## Principles

1. **One accent color.** Emerald is the brand accent (`#089447` / `#10b981`).
   Reserve saturated color for genuine meaning — a real status, a true alert,
   the one primary CTA. No rainbow icon rows, no per-item hues that encode
   nothing (e.g. Top-Forms/Top-Submitters rank bars are neutral/emerald, not
   violet/sky). If a color doesn't distinguish a state, it should be zinc.

2. **Motion only on meaning.** No perpetual/idle animation. Jerry's orb rests
   at a single gentle breathe and only spins/orbits behind `.is-thinking` while
   actually answering. No infinite pulses on static pages; a one-shot entrance
   at most. Never `animate-ping` alarm-red on a support/reading surface. Honor
   `prefers-reduced-motion`.

3. **Say each fact once.** Don't render the same value two or three times in one
   viewport (status/priority, streak/XP, counts). Pick the one canonical home
   (e.g. the ticket's Status & Priority editor; the Learn top-bar chips) and
   drop the echoes.

4. **Primary content first; hide the rest.** Put what the user opened the page
   for at the top (a ticket's Problem Description, not editing chrome). Fold
   read-only/secondary detail into a collapsed `<details>` disclosure rather
   than a stack of equal-weight cards. Give secondary cards a flat/borderless
   treatment so the primary cards read as elevated.

5. **No ghost cards.** Don't render full disabled "coming soon" tiles for
   unbuilt features — collapse them to a one-line muted note so the live action
   stands alone.

6. **Restraint on badges/pills.** Count badges are soft tinted chips
   (`bg-<tone>-500/10` + colored text), not solid saturated fills — reserve a
   solid fill for genuine critical/overdue. Status pills are a single soft fill
   (no border), `font-semibold` not `bold`.

7. **One glow, modest hero.** `PortalHero` uses a single subtle brand glow and a
   modest band — don't inflate the height or title, don't stack multiple glows.

## The reference surfaces

The calmest things in the portal are the target aesthetic: the **KB article
reader** (`/support/kb/[slug]`), the **`iat-home`** landing page, and the
**`iat-ticketing`** app. When a new surface feels busy, measure it against those,
and prefer **subtracting** over adding.

_History: the whole portal got a subtractive density pass on 2026-07-01; see the
CHANGELOG entry of that date._
