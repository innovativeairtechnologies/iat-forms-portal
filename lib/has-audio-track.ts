/* Does this recording actually contain sound?
 *
 * WHY THIS EXISTS. A microphone blocked for the site makes a phone's camera film
 * with no audio track at all. The clip looks completely normal to the person who
 * shot it — it plays, it is the right length, it is megabytes big. The silence is
 * found days later by an engineer opening the finding, by which point the unit
 * has shipped and the walk cannot be redone. Confirmed 2026-09-01 on three real
 * uploads: `vide` handler and avc1 video, no `soun` handler, no audio codec.
 *
 * The obvious guard — asking `navigator.permissions` whether the microphone is
 * denied — is NOT enough on its own, and that is the whole reason for this file.
 * `permissions.query({name:'microphone'})` is unsupported in several browsers
 * people actually use here (it throws on older WebKit, and the shop floor runs
 * DuckDuckGo, Chrome, Samsung Internet and Safari), so the pre-emptive banner can
 * be silent on exactly the device that has the problem. Looking at the bytes
 * works everywhere, because it asks about the file rather than the browser.
 *
 * HOW. QuickTime and MP4 both describe each track with an `hdlr` atom whose
 * handler type — four bytes at offset 12 — is 'vide' for picture and 'soun' for
 * sound. Finding no 'soun' handler anywhere means no audio track.
 *
 * ⚠️ Offset 12, not 8. Offset 8 is the *component* type ('mhlr'), and reading it
 * there reports zero handlers for every file, including ones that plainly have a
 * video track. That mistake was made once already while diagnosing this.
 *
 * Scanned in chunks rather than by reading the whole file into one buffer: these
 * are up to 135MB and this runs on a phone that is about to upload them.
 * Consecutive chunks overlap so an `hdlr` atom lying across a boundary is still
 * seen.
 *
 * Returns null — meaning "cannot tell" — for anything that is not an ISO-BMFF
 * container, or if reading fails. A caller must treat null as no answer and stay
 * quiet: claiming a clip is silent when it is not would teach people to ignore
 * the warning. */

const CHUNK = 4 * 1024 * 1024
const OVERLAP = 32

function findSoun(buf: Uint8Array): boolean {
  // 'hdlr' = 0x68 0x64 0x6c 0x72, then handler type at +12.
  for (let i = 0; i + 16 <= buf.length; i++) {
    if (buf[i] === 0x68 && buf[i + 1] === 0x64 && buf[i + 2] === 0x6c && buf[i + 3] === 0x72) {
      if (buf[i + 12] === 0x73 && buf[i + 13] === 0x6f && buf[i + 14] === 0x75 && buf[i + 15] === 0x6e) {
        return true
      }
    }
  }
  return false
}

/** True = has sound, false = definitely silent, null = cannot tell. */
export async function hasAudioTrack(file: Blob): Promise<boolean | null> {
  try {
    // Recognise the container before judging it. ISO-BMFF and QuickTime both put
    // a brand box at offset 4: 'ftyp' (mp4/m4v) or 'moov'/'mdat'/'wide'/'free'
    // (QuickTime .mov straight off an iPhone).
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    if (head.length < 8) return null
    const box = String.fromCharCode(head[4], head[5], head[6], head[7])
    if (!['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(box)) return null

    let sawHandler = false
    for (let start = 0; start < file.size; start += CHUNK - OVERLAP) {
      const end = Math.min(start + CHUNK, file.size)
      const buf = new Uint8Array(await file.slice(start, end).arrayBuffer())
      if (findSoun(buf)) return true
      // Track whether we ever saw ANY hdlr atom. If we saw none at all, the
      // parse found nothing it understands and "silent" would be a guess.
      if (!sawHandler) {
        for (let i = 0; i + 4 <= buf.length; i++) {
          if (buf[i] === 0x68 && buf[i + 1] === 0x64 && buf[i + 2] === 0x6c && buf[i + 3] === 0x72) {
            sawHandler = true
            break
          }
        }
      }
      if (end >= file.size) break
    }
    return sawHandler ? false : null
  } catch {
    return null
  }
}
