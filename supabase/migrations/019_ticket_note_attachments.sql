-- 019_ticket_note_attachments.sql
-- Lets admins drag-and-drop files (and saved emails: .eml/.msg) into ticket notes.

-- 1. Attachment metadata on each note: [{ path, name, type, size }, ...]
--    `path` is the object key in the ticket-attachments bucket (prefixed by the
--    ticket id). Defaults to an empty array so existing notes are unaffected and
--    text-only notes never need to set it.
alter table public.ticket_notes
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2. Private storage bucket for the files themselves. public=false because notes
--    can contain customer emails / PII. All reads and writes go through the
--    admin-gated API routes using the service-role client (which bypasses RLS),
--    and downloads are handed out as short-lived signed URLs — so no storage
--    object policies are required here.
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;
