// ─── Room render assets ──────────────────────────────────────────────────────
//
// An index of the room artwork held in Supabase Storage, generated rather than
// typed by hand. Nothing here is a file in this repo: the images live in the
// public `render-assets` bucket, and this is the map from a stable key to a URL.
//
// Three sets, uploaded 2026-08-20:
//
//   rooms         39  full renders WITH a background, 1920x1080, no alpha
//   rooms-cutout  37  the same rooms cut out, transparent, ~1600 wide
//   overlays      10  labelled layers to composite over a cutout
//
// Sources were 275 MB of 4K JPEG/PNG; these are webp at 8.5 MB total. The masters
// are NOT here and NOT in git — they belong in the SharePoint backup.
//
// ⚠️ COMPOSITING ONLY WORKS WHERE `overlayCanvas` IS TRUE.
// The overlays were drawn on a 2600x1980 master canvas. Only 16 of the 37 cutouts
// were exported on that canvas; the other 21 were trimmed to their content
// bounds, so every one is a slightly different size and an overlay laid over them
// lands in the wrong place at the wrong scale. Trimming discards the offset, so it
// cannot be recovered from the file — those rooms need re-exporting at full canvas.
//
// ⚠️ `school` is one of the trimmed ones, and School is one of only two rooms that
// HAS overlays. So of the two overlay sets shipped, only `food` can actually be
// composited today.
//
// ⚠️ The two room sets do not share keys or framing. `rooms` is 16:9; `rooms-cutout`
// is about 1.31:1, so they are not interchangeable in one layout slot. Names drifted
// too — `food` vs `food-processing`, `cannabis-room` vs `cannabis`, three museum
// variants against one. Pair them with an explicit map, never by string munging.
//
// Regenerate by re-running the convert/upload scripts; do not hand-edit.

export type RenderSet = 'rooms' | 'rooms-cutout' | 'overlays'

export type RenderAsset = {
  /** Stable slug, e.g. 'food-processing' or 'school-make-up-air'. */
  key: string
  set: RenderSet
  /** Path inside the bucket. */
  file: string
  width: number
  height: number
  hasAlpha: boolean
  /** True when this sits on the 2600x1980 master canvas the overlays share. */
  overlayCanvas: boolean
  /** Overlays only: which room it belongs to. */
  room?: string
  /** Overlays only: which layer, e.g. 'openings', 'make-up-air'. */
  layer?: string
  /** Original filename, so a master can be traced back in SharePoint. */
  source: string
}

const BUCKET_BASE =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dsbuhdjlkgwcghskvdse.supabase.co')
  + '/storage/v1/object/public/render-assets/'

/** Full public URL for an asset. The bucket is public and the host is already
 *  pinned in next.config's remotePatterns, so next/image can take these. */
export const renderAssetUrl = (a: RenderAsset): string => BUCKET_BASE + a.file

export const RENDER_ASSETS: RenderAsset[] = [
  { key: "food-dimensions", set: "overlays", file: "overlays/food-dimensions.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "food", layer: "dimensions", source: "Room Asset Overlays/Food Dimensions.png" },
  { key: "food-occupants", set: "overlays", file: "overlays/food-occupants.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "food", layer: "occupants", source: "Room Asset Overlays/Food Occupants.png" },
  { key: "food-openings", set: "overlays", file: "overlays/food-openings.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "food", layer: "openings", source: "Room Asset Overlays/Food Openings.png" },
  { key: "food-product", set: "overlays", file: "overlays/food-product.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "food", layer: "product", source: "Room Asset Overlays/Food Product.png" },
  { key: "school-dimensions", set: "overlays", file: "overlays/school-dimensions.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "dimensions", source: "Room Asset Overlays/School Dimensions.png" },
  { key: "school-exhaust-air", set: "overlays", file: "overlays/school-exhaust-air.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "exhaust-air", source: "Room Asset Overlays/School Exhaust Air.png" },
  { key: "school-make-up-air", set: "overlays", file: "overlays/school-make-up-air.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "make-up-air", source: "Room Asset Overlays/School Make-up-Air.png" },
  { key: "school-occupants", set: "overlays", file: "overlays/school-occupants.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "occupants", source: "Room Asset Overlays/School Occupants.png" },
  { key: "school-openings", set: "overlays", file: "overlays/school-openings.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "openings", source: "Room Asset Overlays/School Openings.png" },
  { key: "school-product-load", set: "overlays", file: "overlays/school-product-load.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, room: "school", layer: "product-load", source: "Room Asset Overlays/School Product Load.png" },
  { key: "aerospace", set: "rooms", file: "rooms/aerospace.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/aerospace.jpg" },
  { key: "automotive", set: "rooms", file: "rooms/automotive.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/automotive.jpg" },
  { key: "battery", set: "rooms", file: "rooms/battery.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/battery.jpg" },
  { key: "brewery-1", set: "rooms", file: "rooms/brewery-1.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/brewery (1).jpg" },
  { key: "cannabis-room", set: "rooms", file: "rooms/cannabis-room.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/cannabis room.jpg" },
  { key: "chemical-lab", set: "rooms", file: "rooms/chemical-lab.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/chemical lab.jpg" },
  { key: "cleanroom", set: "rooms", file: "rooms/cleanroom.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/cleanroom.jpg" },
  { key: "commercial", set: "rooms", file: "rooms/commercial.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/commercial.jpg" },
  { key: "conveying", set: "rooms", file: "rooms/conveying.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/conveying.jpg" },
  { key: "cooler-freezer", set: "rooms", file: "rooms/cooler-freezer.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/cooler.freezer.jpg" },
  { key: "covid", set: "rooms", file: "rooms/covid.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/covid.jpg" },
  { key: "electrical-lab-pcb", set: "rooms", file: "rooms/electrical-lab-pcb.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/electrical lab -PCB.jpg" },
  { key: "food", set: "rooms", file: "rooms/food.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/food.jpg" },
  { key: "glass-lamination", set: "rooms", file: "rooms/glass-lamination.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/glass lamination.jpg" },
  { key: "goverment", set: "rooms", file: "rooms/goverment.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/goverment.jpg" },
  { key: "grocery", set: "rooms", file: "rooms/grocery.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/grocery.jpg" },
  { key: "grow-room", set: "rooms", file: "rooms/grow-room.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/grow room.jpg" },
  { key: "hospital", set: "rooms", file: "rooms/hospital.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/hospital.jpg" },
  { key: "ice-rink", set: "rooms", file: "rooms/ice-rink.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/ice rink.jpg" },
  { key: "laboratory", set: "rooms", file: "rooms/laboratory.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/laboratory.jpg" },
  { key: "library", set: "rooms", file: "rooms/library.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/library.jpg" },
  { key: "long-term-storage", set: "rooms", file: "rooms/long-term-storage.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/long term storage.jpg" },
  { key: "manufacturing", set: "rooms", file: "rooms/manufacturing.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/manufacturing.jpg" },
  { key: "medical-lab", set: "rooms", file: "rooms/medical-lab.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/medical lab.jpg" },
  { key: "military", set: "rooms", file: "rooms/military.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/military.jpg" },
  { key: "museum-1-glass-case", set: "rooms", file: "rooms/museum-1-glass-case.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/museum - 1 glass case.jpg" },
  { key: "museum-2-glass-cases", set: "rooms", file: "rooms/museum-2-glass-cases.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/museum - 2 glass cases.jpg" },
  { key: "museum-no-glass-case", set: "rooms", file: "rooms/museum-no-glass-case.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/museum - no glass case.jpg" },
  { key: "nuclear", set: "rooms", file: "rooms/nuclear.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/nuclear.jpg" },
  { key: "other", set: "rooms", file: "rooms/other.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/other.jpg" },
  { key: "packaging", set: "rooms", file: "rooms/packaging.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/packaging.jpg" },
  { key: "pharmaceutical", set: "rooms", file: "rooms/pharmaceutical.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/pharmaceutical.jpg" },
  { key: "plastics", set: "rooms", file: "rooms/plastics.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/plastics.jpg" },
  { key: "processing-1", set: "rooms", file: "rooms/processing-1.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/processing (1).jpg" },
  { key: "residential-1", set: "rooms", file: "rooms/residential-1.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/residential (1).jpg" },
  { key: "school", set: "rooms", file: "rooms/school.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/school.jpg" },
  { key: "silo", set: "rooms", file: "rooms/silo.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/silo.jpg" },
  { key: "testing-lab", set: "rooms", file: "rooms/testing-lab.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/testing lab.jpg" },
  { key: "water-treatment-plant", set: "rooms", file: "rooms/water-treatment-plant.webp", width: 1920, height: 1080, hasAlpha: false, overlayCanvas: false, source: "Rooms/water treatment plant.jpg" },
  { key: "aerospace", set: "rooms-cutout", file: "rooms-cutout/aerospace.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Aerospace no background.png" },
  { key: "automotive", set: "rooms-cutout", file: "rooms-cutout/automotive.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Automotive no background.png" },
  { key: "battery", set: "rooms-cutout", file: "rooms-cutout/battery.webp", width: 1600, height: 1212, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/battery no background.png" },
  { key: "brewery", set: "rooms-cutout", file: "rooms-cutout/brewery.webp", width: 1600, height: 1213, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/brewery no background.png" },
  { key: "cannabis", set: "rooms-cutout", file: "rooms-cutout/cannabis.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Cannabis no background.png" },
  { key: "chemical-lab", set: "rooms-cutout", file: "rooms-cutout/chemical-lab.webp", width: 1600, height: 1211, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/chemical-lab no background.png" },
  { key: "cleanroom", set: "rooms-cutout", file: "rooms-cutout/cleanroom.webp", width: 1600, height: 1213, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/cleanroom no background.png" },
  { key: "cold-storage", set: "rooms-cutout", file: "rooms-cutout/cold-storage.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Cold Storage no background.png" },
  { key: "conveying", set: "rooms-cutout", file: "rooms-cutout/conveying.webp", width: 1600, height: 1213, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/conveying no background.png" },
  { key: "covid", set: "rooms-cutout", file: "rooms-cutout/covid.webp", width: 1600, height: 1210, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/covid no background.png" },
  { key: "electronics", set: "rooms-cutout", file: "rooms-cutout/electronics.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Electronics no background.png" },
  { key: "food-processing", set: "rooms-cutout", file: "rooms-cutout/food-processing.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Food Processing without background.png" },
  { key: "glass-lamination", set: "rooms-cutout", file: "rooms-cutout/glass-lamination.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Glass Lamination no background.png" },
  { key: "goverment", set: "rooms-cutout", file: "rooms-cutout/goverment.webp", width: 1600, height: 1211, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/goverment no background.png" },
  { key: "grocery", set: "rooms-cutout", file: "rooms-cutout/grocery.webp", width: 1600, height: 1210, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/grocery no background.png" },
  { key: "grow-room", set: "rooms-cutout", file: "rooms-cutout/grow-room.webp", width: 1600, height: 1212, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/grow-room no background.png" },
  { key: "hospital", set: "rooms-cutout", file: "rooms-cutout/hospital.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Hospital no background.png" },
  { key: "ice-rink", set: "rooms-cutout", file: "rooms-cutout/ice-rink.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Ice Rink without background.png" },
  { key: "lab", set: "rooms-cutout", file: "rooms-cutout/lab.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Lab no background.png" },
  { key: "library", set: "rooms-cutout", file: "rooms-cutout/library.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Library no background.png" },
  { key: "long-term-storage", set: "rooms-cutout", file: "rooms-cutout/long-term-storage.webp", width: 1600, height: 1211, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/long-term-storage no background.png" },
  { key: "manufacturing", set: "rooms-cutout", file: "rooms-cutout/manufacturing.webp", width: 1600, height: 1212, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/manufacturing no background.png" },
  { key: "medical-lab", set: "rooms-cutout", file: "rooms-cutout/medical-lab.webp", width: 1600, height: 1210, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/medical-lab no background.png" },
  { key: "military", set: "rooms-cutout", file: "rooms-cutout/military.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Military no background.png" },
  { key: "misc-space", set: "rooms-cutout", file: "rooms-cutout/misc-space.webp", width: 1600, height: 1213, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/Misc.-Space no background.png" },
  { key: "museum", set: "rooms-cutout", file: "rooms-cutout/museum.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Museum no background.png" },
  { key: "nuclear", set: "rooms-cutout", file: "rooms-cutout/nuclear.webp", width: 1600, height: 1214, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/nuclear no background.png" },
  { key: "packaging", set: "rooms-cutout", file: "rooms-cutout/packaging.webp", width: 1600, height: 1212, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/packaging no background.png" },
  { key: "pharmaceutical", set: "rooms-cutout", file: "rooms-cutout/pharmaceutical.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Pharmaceutical no background.png" },
  { key: "plastics", set: "rooms-cutout", file: "rooms-cutout/plastics.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/Plastics no background.png" },
  { key: "processing", set: "rooms-cutout", file: "rooms-cutout/processing.webp", width: 1600, height: 1211, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/processing no background.png" },
  { key: "residential", set: "rooms-cutout", file: "rooms-cutout/residential.webp", width: 1600, height: 1207, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/residential no background.png" },
  { key: "school", set: "rooms-cutout", file: "rooms-cutout/school.webp", width: 1600, height: 1215, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/school no background.png" },
  { key: "silo", set: "rooms-cutout", file: "rooms-cutout/silo.webp", width: 1600, height: 910, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/silo no background.png" },
  { key: "testing-lab", set: "rooms-cutout", file: "rooms-cutout/testing-lab.webp", width: 1600, height: 1218, hasAlpha: true, overlayCanvas: true, source: "Rooms without Background/testing lab no background.png" },
  { key: "warehouse-commercial-other", set: "rooms-cutout", file: "rooms-cutout/warehouse-commercial-other.webp", width: 1600, height: 1214, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/warehouse_commercial_other no background.png" },
  { key: "water-treatment", set: "rooms-cutout", file: "rooms-cutout/water-treatment.webp", width: 1600, height: 1216, hasAlpha: true, overlayCanvas: false, source: "Rooms without Background/Water treatment_no background.png" },
]

const byKey = new Map(RENDER_ASSETS.map(a => [a.set + '/' + a.key, a]))

/** One asset, or undefined. Never throws — a missing render is not worth a crash. */
export const renderAsset = (set: RenderSet, key: string): RenderAsset | undefined =>
  byKey.get(set + '/' + key)

export const assetsInSet = (set: RenderSet): RenderAsset[] =>
  RENDER_ASSETS.filter(a => a.set === set)

/** Overlay layers available for a room, e.g. overlaysForRoom('food'). */
export const overlaysForRoom = (room: string): RenderAsset[] =>
  RENDER_ASSETS.filter(a => a.set === 'overlays' && a.room === room)

/**
 * Cutouts an overlay can legitimately be laid over. Everything else was trimmed
 * and would misalign — see the warning at the top of this file.
 */
export const compositableCutouts = (): RenderAsset[] =>
  RENDER_ASSETS.filter(a => a.set === 'rooms-cutout' && a.overlayCanvas)
