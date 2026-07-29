/* The stable identity of a DryWare project, shared by server and client.

   Lives in its own module so client components can compute it without pulling
   lib/dryware-deals.ts (and materializeDealsFromProjectedSales with it) into the
   browser bundle.

   Why this and not a row id: projected_sales is wiped and fully reloaded on
   every sync (`DELETE` + `INSERT` in replace_projected_sales), and its id column
   is GENERATED ALWAYS AS IDENTITY — a DELETE does not reset the sequence, so
   every row gets a brand-new id each sync. `customer|project` is the only handle
   that survives, which is exactly why deals.dryware_key stores it (migration 063). */

/** `company` is always "Innovative Air" (the seller) — the account is
 *  project_customer, so the key never uses company. */
export function drywareKey(projectCustomer: string | null, projectName: string | null): string | null {
  const c = (projectCustomer ?? '').trim().toLowerCase()
  const p = (projectName ?? '').trim().toLowerCase()
  if (!c && !p) return null
  return `${c}|${p}`
}
