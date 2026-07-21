// ─────────────────────────────────────────────────────────────────────────────
// Microsoft Graph — read-only SharePoint access for the Jerry's Brain sync.
//
// App-only (client-credentials) auth against ONE document library, using the
// least-privilege `Sites.Selected` permission an admin consents to. No SDK — just
// the Graph REST API over fetch, so no new dependency. READ ONLY for v1: this
// module never writes to SharePoint (that's the deferred "Push" half, which would
// need write consent).
//
// Env (set in Vercel; never committed):
//   MS_GRAPH_TENANT_ID       Directory (tenant) ID
//   MS_GRAPH_CLIENT_ID       Application (client) ID
//   MS_GRAPH_CLIENT_SECRET   client secret value  (or move to certificate later)
//   SHAREPOINT_SITE_URL      e.g. https://contoso.sharepoint.com/sites/IATDocumentation
//   SHAREPOINT_LIBRARY_NAME  (optional) document-library name; defaults to the site's default library
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH = 'https://graph.microsoft.com/v1.0'

export type GraphDriveItem = {
  id: string
  name?: string
  eTag?: string
  webUrl?: string
  size?: number
  lastModifiedDateTime?: string
  file?: { mimeType?: string }
  folder?: { childCount?: number }
  deleted?: { state?: string }
  lastModifiedBy?: { user?: { displayName?: string } }
}

export class GraphError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GraphError'
    this.status = status
  }
}

/** True only when auth is set AND we can locate the library — either by its
 *  human URL (SHAREPOINT_SITE_URL) or, more robustly, by its immutable id
 *  (SHAREPOINT_SITE_ID). Callers no-op cleanly otherwise. */
export function graphConfigured(): boolean {
  return !!(
    process.env.MS_GRAPH_TENANT_ID &&
    process.env.MS_GRAPH_CLIENT_ID &&
    process.env.MS_GRAPH_CLIENT_SECRET &&
    (process.env.SHAREPOINT_SITE_URL || process.env.SHAREPOINT_SITE_ID)
  )
}

// ── token (cached in module scope; refreshed a minute before expiry) ──────────
let tokenCache: { token: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const tenant = process.env.MS_GRAPH_TENANT_ID!
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.MS_GRAPH_CLIENT_ID!,
      client_secret: process.env.MS_GRAPH_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new GraphError(`Could not authenticate to Microsoft Graph: ${json.error_description || res.statusText}`, res.status)
  }
  tokenCache = { token: json.access_token, expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000 }
  return tokenCache.token
}

async function graphGet<T>(pathOrUrl: string): Promise<T> {
  const token = await getToken()
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH}${pathOrUrl}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new GraphError(body.error?.message || `Graph request failed (${res.status})`, res.status)
  }
  return res.json() as Promise<T>
}

// ── resolve the target library (site id + drive id), cached ───────────────────
let libraryCache: { siteId: string; driveId: string; siteName: string; libraryName: string } | null = null

export async function resolveLibrary(): Promise<{ siteId: string; driveId: string; siteName: string; libraryName: string }> {
  if (libraryCache) return libraryCache

  // ── locate the SITE ──────────────────────────────────────────────────────────
  // Prefer the immutable site id if it's pinned in env — SharePoint site ids don't
  // change when a site is renamed or its URL changes, so pinning the id makes us
  // completely immune to a URL change (no env edit needed on a rename). Otherwise
  // resolve the id from the human-friendly URL.
  let siteId: string
  let siteName: string
  const pinnedSiteId = process.env.SHAREPOINT_SITE_ID?.trim()
  if (pinnedSiteId) {
    const site = await graphGet<{ id: string; displayName?: string; name?: string }>(`/sites/${pinnedSiteId}`)
    siteId = site.id
    siteName = site.displayName || site.name || pinnedSiteId
  } else {
    const u = new URL(process.env.SHAREPOINT_SITE_URL!)
    const sitePath = u.pathname.replace(/^\/+|\/+$/g, '') // e.g. "sites/IATDocumentation"
    const site = await graphGet<{ id: string; displayName?: string; name?: string }>(`/sites/${u.hostname}:/${sitePath}`)
    siteId = site.id
    siteName = site.displayName || site.name || sitePath
  }

  // ── locate the DRIVE (document library) ──────────────────────────────────────
  const pinnedDriveId = process.env.SHAREPOINT_DRIVE_ID?.trim()
  const wantLibrary = process.env.SHAREPOINT_LIBRARY_NAME?.trim()
  let driveId: string
  let libraryName: string
  if (pinnedDriveId) {
    const drive = await graphGet<{ id: string; name?: string }>(`/drives/${pinnedDriveId}`)
    driveId = drive.id
    libraryName = drive.name || 'Documents'
  } else if (wantLibrary) {
    const drives = await graphGet<{ value: { id: string; name?: string; driveType?: string }[] }>(`/sites/${siteId}/drives`)
    const match = drives.value.find((d) => (d.name || '').toLowerCase() === wantLibrary.toLowerCase())
    if (!match) {
      throw new GraphError(`Document library "${wantLibrary}" not found on that site. Available: ${drives.value.map((d) => d.name).join(', ') || '(none)'}`)
    }
    driveId = match.id
    libraryName = match.name || wantLibrary
  } else {
    const drive = await graphGet<{ id: string; name?: string }>(`/sites/${siteId}/drive`)
    driveId = drive.id
    libraryName = drive.name || 'Documents'
  }

  libraryCache = { siteId, driveId, siteName, libraryName }
  return libraryCache
}

/** Smoke test: the first `limit` items in the library root. Proves the pipe end-to-end. */
export async function listLibraryTop(limit = 20): Promise<GraphDriveItem[]> {
  const { driveId } = await resolveLibrary()
  const page = await graphGet<{ value: GraphDriveItem[] }>(`/drives/${driveId}/root/children?$top=${limit}&$select=id,name,size,file,folder,lastModifiedDateTime,webUrl,lastModifiedBy,eTag`)
  return page.value
}

/**
 * Delta sync: pass the stored deltaLink (or nothing for a first full pass).
 * Returns every changed item since then, plus the new deltaLink to persist for
 * next time. Walks nextLink pagination internally. This is the "what changed
 * since last time" call the scheduled pull is built on — light on Graph even for
 * large libraries.
 */
export async function driveDelta(deltaLink?: string | null): Promise<{ items: GraphDriveItem[]; deltaLink: string }> {
  const { driveId } = await resolveLibrary()
  let url =
    deltaLink ||
    `${GRAPH}/drives/${driveId}/root/delta?$select=id,name,size,file,folder,deleted,lastModifiedDateTime,webUrl,lastModifiedBy,eTag`
  const items: GraphDriveItem[] = []
  // Follow @odata.nextLink until we get the terminal @odata.deltaLink.
  for (let guard = 0; guard < 1000; guard++) {
    const page = await graphGet<{ value: GraphDriveItem[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(url)
    items.push(...(page.value || []))
    if (page['@odata.deltaLink']) return { items, deltaLink: page['@odata.deltaLink'] }
    if (page['@odata.nextLink']) { url = page['@odata.nextLink']; continue }
    // No delta or next link (shouldn't happen) — stop with what we have.
    return { items, deltaLink: url }
  }
  throw new GraphError('Delta pagination did not terminate')
}

/** Download one file's bytes. Returns the raw content for the analyze engine. */
export async function downloadItem(itemId: string): Promise<Buffer> {
  const { driveId } = await resolveLibrary()
  const token = await getToken()
  const res = await fetch(`${GRAPH}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  })
  if (!res.ok) throw new GraphError(`Could not download item ${itemId} (${res.status})`, res.status)
  return Buffer.from(await res.arrayBuffer())
}
