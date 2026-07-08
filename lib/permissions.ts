import 'server-only'
import { cache } from 'react'
import { supabaseAdmin } from './supabase-admin'
import { DEFAULT_ROLE_PERMS, STAFF_ROLES, type Perm, type PermMatrix, type StaffRole } from './roles'

// ─────────────────────────────────────────────────────────────────────────────
// lib/permissions.ts — reads the editable role→perm matrix (migration 045).
//
// The matrix is what the /admin/permissions page toggles. Server components,
// the /admin layout (which feeds it to the client), and admin-auth's can() all
// read it through here. Middleware does NOT use this (it runs on the edge and
// uses the request-scoped anon client for one role instead — see middleware.ts).
//
// FAIL-SAFE: if the table is missing (pre-migration), the read errors, or it
// comes back empty, we fall back to DEFAULT_ROLE_PERMS — i.e. exactly today's
// hardcoded behavior. A DB hiccup can never silently widen OR fully revoke
// access; only a real, non-empty matrix row-set overrides the defaults.
// ─────────────────────────────────────────────────────────────────────────────

const SCOPED_ROLES = STAFF_ROLES.filter((r): r is Exclude<StaffRole, 'admin'> => r !== 'admin')

// Cached per request (React cache) so repeated reads in one render/route share
// a single query.
export const getPermMatrix = cache(async (): Promise<PermMatrix> => {
  try {
    const { data, error } = await supabaseAdmin.from('role_permissions').select('role, perm')
    if (error || !data || data.length === 0) return { ...DEFAULT_ROLE_PERMS }

    // Seed every scoped role to an empty list first, so a role whose perms were
    // all toggled off comes back as [] (revoked) rather than falling through to
    // its defaults.
    const matrix: PermMatrix = {}
    for (const r of SCOPED_ROLES) matrix[r] = []
    for (const row of data) {
      const role = row.role as StaffRole
      if (role in matrix) (matrix[role] as Perm[]).push(row.perm as Perm)
    }
    return matrix
  } catch {
    return { ...DEFAULT_ROLE_PERMS }
  }
})
