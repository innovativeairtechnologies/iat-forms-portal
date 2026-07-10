/**
 * One-off: remove the "Recorded readings" (L1–L2 … L3–G voltages) from the
 * Electrical Power section of the LIVE, admin-edited SRV content (srv_config
 * row, migration 046). The code default (lib/srv.ts) was also updated, but the
 * DB row is the source of truth in prod, so it must be edited too.
 *
 * Surgical: only strips `readings` from the `electrical` section — every other
 * edit Kacy/etc. made to the content is preserved. A backup of the whole row is
 * written to scripts/.srv-config-backup.json before writing.
 *
 * Run with: node scripts/strip-electrical-readings.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await sb.from('srv_config').select('*').eq('id', 1).maybeSingle()
if (error) { console.error('Read failed:', error.message); process.exit(1) }
if (!data) { console.log('No srv_config row — code fallback in use, nothing to strip.'); process.exit(0) }

writeFileSync(resolve(__dirname, '.srv-config-backup.json'), JSON.stringify(data, null, 2))
console.log('Backed up current row → scripts/.srv-config-backup.json')

const sections = data.sections
const el = Array.isArray(sections) ? sections.find(s => s.key === 'electrical') : null
if (!el) { console.error('No electrical section found — aborting, nothing changed.'); process.exit(1) }
if (!el.readings || el.readings.length === 0) {
  console.log('Electrical section already has no readings — nothing to do.'); process.exit(0)
}
console.log('Removing electrical readings:', el.readings.map(r => r.label).join(', '))
delete el.readings

const { error: upErr } = await sb.from('srv_config')
  .update({ sections, updated_at: new Date().toISOString(), updated_by: 'system: strip-electrical-readings' })
  .eq('id', 1)
if (upErr) { console.error('Update failed:', upErr.message); process.exit(1) }
console.log('Done — electrical readings removed from live SRV content.')
