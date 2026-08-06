// One definition of how large a document may be, imported by both sides.
//
// It was two: the browser refused >20MB before uploading, and the signed-URL
// route refused >20MB again on the server. Raising the ceiling touched the
// server copy only, so the browser went on rejecting the exact files the change
// was meant to allow — instantly, before a single byte moved, which reads like
// the upload being ignored rather than refused.
//
// A limit enforced in two places is a limit that will disagree with itself
// eventually. The client check is the fast, friendly one; the server check is
// the one that actually binds (a browser can be bypassed). Both now read this.
//
// The value is bounded by storage, not by the reader: a born-digital PDF has its
// text layer read locally with no size or page ceiling. Supabase's own per-file
// limit applies underneath — the effective maximum is the lower of this and the
// bucket's setting.
export const KB_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const KB_MAX_UPLOAD_LABEL = '50MB'
