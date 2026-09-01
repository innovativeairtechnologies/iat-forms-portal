/* What to actually tell somebody whose microphone is blocked.
 *
 * ⚠️ WRITE FOR THE BROWSER IN THEIR HAND, NOT SAFARI.
 *
 * The first version of this advice gave Safari's "aA › Website Settings" path.
 * The person who hit the bug was on DuckDuckGo, where that menu does not exist,
 * so the instructions were noise. The shop floor is phones people chose
 * themselves — Safari, Chrome, DuckDuckGo, Samsung Internet, whatever shipped on
 * the device — and a walkaround is filmed on all of them.
 *
 * Two layers have to be right on a phone, and only the FIRST is common to every
 * browser:
 *
 *   1. The OS lets the browser app use the microphone at all.
 *      iOS: Settings › <the app> › Microphone. Android: Settings › Apps ›
 *      <the app> › Permissions › Microphone. This is the layer people miss,
 *      because a browser cannot prompt its way past it — it just fails.
 *   2. The browser lets THIS SITE use it. Wording differs per browser, and for
 *      several of them there is no stable menu path worth asserting.
 *
 * So step 1 is always given and is always correct — "Settings › <name> ›
 * Microphone" holds for any iOS app, whatever it is. Step 2 is only spelled out
 * where the path is genuinely known; everywhere else it says to reload and allow
 * when asked, which is true everywhere and cannot mislead.
 *
 * ⛔ Do not add a confident menu path for a browser without checking it on a real
 * device. Wrong instructions are worse than general ones: they send somebody
 * looking for a menu that does not exist and they conclude the app is broken. */

export type MicHelp = {
  /** The browser's own name, so the OS step can name the app to open. */
  browser: string
  steps: string[]
}

function browserName(ua: string, ios: boolean, android: boolean): string {
  // Order matters: every iOS browser carries "Safari" in its UA, so the
  // wrappers must be tested BEFORE Safari or they all read as Safari.
  if (/DuckDuckGo|Ddg/i.test(ua)) return 'DuckDuckGo'
  if (/CriOS/.test(ua)) return 'Chrome'
  if (/FxiOS/.test(ua)) return 'Firefox'
  if (/EdgiOS|EdgA?\//.test(ua)) return 'Edge'
  if (/OPiOS|OPR\//.test(ua)) return 'Opera'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/Brave/i.test(ua)) return 'Brave'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (ios && /Safari/.test(ua)) return 'Safari'
  if (/Safari/.test(ua)) return 'Safari'
  return android || ios ? 'your browser' : 'your browser'
}

export function micHelp(ua: string): MicHelp {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))
  const android = /Android/.test(ua)
  const browser = browserName(ua, ios, android)
  const app = browser === 'your browser' ? 'your browser' : browser

  if (ios) {
    const steps = [
      `Open the iPhone Settings app, scroll to ${app}, and turn on Microphone.`,
    ]
    // Only Safari has a path here worth stating outright.
    if (browser === 'Safari') {
      steps.push('In Safari, tap aA in the address bar › Website Settings › Microphone › Allow.')
      steps.push('Also check Settings › Safari › Microphone.')
    } else {
      steps.push(`Come back to this page, reload it, and tap Allow when ${app} asks for the microphone.`)
    }
    steps.push('Photos and typed notes work either way.')
    return { browser, steps }
  }

  if (android) {
    return {
      browser,
      steps: [
        `Open Settings › Apps › ${app} › Permissions › Microphone and allow it.`,
        'In the browser, tap the icon to the left of the address bar › Permissions › Microphone › Allow.',
        'Reload this page.',
        'Photos and typed notes work either way.',
      ],
    }
  }

  return {
    browser,
    steps: [
      'Click the padlock (or the icon left of the address bar) › Site settings › Microphone › Allow.',
      'Check your operating system has not blocked the microphone for the whole browser.',
      'Reload this page.',
    ],
  }
}

/** One-line version, for places with no room for a list. */
export function micHelpLine(ua: string): string {
  const { steps } = micHelp(ua)
  return steps.join(' ')
}
