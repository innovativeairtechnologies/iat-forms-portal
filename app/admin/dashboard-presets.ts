// Plain (non-'use client') module so the server component can import these as
// real values. Importing them from the client picker turned them into client
// references on the server, which crashed /admin ("Attempted to call ... from
// the server but ... on the client").

export const DASH_PRESET_COOKIE = 'iat_dash_preset'
export const PRESETS = ['balanced', 'tickets', 'submissions'] as const
export type Preset = (typeof PRESETS)[number]
