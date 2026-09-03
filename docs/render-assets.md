# Room render assets

Photo-real room artwork, held in Supabase Storage and indexed by
[`lib/render-assets.ts`](../lib/render-assets.ts). Uploaded 2026-08-20.

**Nothing in the portal uses these yet.** This is groundwork so a later build can say
*"show this picture when someone picks that room"* without further plumbing.

## Where they live

| | |
|---|---|
| Bucket | `render-assets` (public) on Supabase project `dsbuhdjlkgwcghskvdse` |
| Index | `lib/render-assets.ts` — generated, **do not hand-edit** |
| Masters | SharePoint site `IATDocumentation`, library **`Render Assets`** |

⚠️ **Not in git, and never should be.** The originals are 590 MB and this repo is public.

⚠️ The masters are in a **separate document library**, not the default `Documents` one.
That is deliberate — the KB sync (`lib/kb-sharepoint-sync.ts`) runs `driveDelta()` over an
entire library from the root, and its supported types include `image/jpeg` and
`image/png`, so a subfolder inside `Documents` would still be swept into Jerry's review
queue. A second library is a different `driveId` and is invisible to it. **Do not point
`SHAREPOINT_LIBRARY_NAME` at it.**

## The three sets

| set | n | what | size |
|---|---|---|---|
| `rooms` | 39 | full render **with** a background | 1920×1080, no alpha |
| `rooms-cutout` | 37 | the same rooms cut out | ~1600 wide, transparent |
| `overlays` | 10 | labeled layers to composite over a cutout | 1600×1218, transparent |

Sources were 275 MB of 4K JPEG/PNG; these are webp at **8.5 MB** total. That mattered —
Supabase was already at 285 MB of a 1 GB cap, and raw would have left ~150 MB and
eventually broken ticket-photo uploads, which is a live customer path.

Cutouts and overlays are both scaled to **1600 wide** so the same factor applies to each
and the layers stay registered.

## Using them

```ts
import { renderAsset, overlaysForRoom, renderAssetUrl } from '@/lib/render-assets'

const room = renderAsset('rooms-cutout', 'food-processing')
if (room) <Image src={renderAssetUrl(room)} width={room.width} height={room.height} alt="…" />

overlaysForRoom('food')   // dimensions, occupants, openings, product
compositableCutouts()     // only the cutouts a layer will actually line up on
```

The Supabase host is already pinned in `next.config`'s `remotePatterns`, so `next/image`
takes these URLs with no config change. ⛔ Do **not** widen that to a wildcard.

## 🔴 Known limits

**Overlays line up on 16 of the 37 cutouts.** They were drawn on a 2600×1980 master
canvas. The other 21 were exported **trimmed to their content bounds**, so each is a
different size and a layer over them lands at the wrong offset and scale. Trimming
discards the offset — it cannot be recovered from the file. Those rooms need re-exporting
at full canvas. `overlayCanvas` flags which are safe.

**Only two rooms have layers at all** (`food`, `school`) — and `school` is one of the
trimmed ones. **So only `food` composites today.**

**The two room sets share neither framing nor names.** `rooms` is 16:9, `rooms-cutout` is
about 1.31:1, so they are not interchangeable in one layout slot. Names drifted too:
`food` vs `food-processing`, `cannabis-room` vs `cannabis`, `cooler-freezer` vs
`cold-storage`, three museum variants against one, and `electrical lab -PCB` vs
`Electronics` which may not even be the same room. Only 25 of ~39 pair automatically.
**Pair them with an explicit map, never by munging strings.**

**Only 7 of the 18 RFQ room presets match a render key** (`cold-storage`, `food`,
`ice-rink`, `water-treatment`, `military`, `cannabis`, `electronics`). The remaining 11
need a hand-written mapping, and several are genuine judgment calls.

## Not uploaded

`Building Materials` (295 MB — but 235 MB of that is video and 10 MB is SketchUp source)
and `Dehumidifier Placement` (35 MB, 13 files, each with a transparent twin). Video is
deliberately out; the portal hosts no video.

⛔ Building Materials overlaps RFQ step 5's wall build-ups. Repointing step 5 at the
bucket was considered and **rejected** — it keeps its three committed files in
`public/rfq/`.

## Regenerating

The convert / upload / index scripts were session scratch files, not committed. The shape:
`sharp().resize({width}).webp({quality: 82})` → POST to
`/storage/v1/object/render-assets/<set>/<key>.webp` with `x-upsert` → emit the typed index.
Re-run all three rather than editing `lib/render-assets.ts` by hand.
