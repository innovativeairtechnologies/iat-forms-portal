-- 021_form_uploads_size_limit.sql
-- Public form file uploads (/api/upload) now hand out a signed upload URL and the
-- browser uploads the bytes directly to storage — routing them through the
-- function 413'd on files over Vercel's ~4.5MB body cap. The route still checks
-- the client-claimed size, but enforce a hard 10MB cap at the storage layer too,
-- since the endpoint is public and the claimed size is spoofable.
update storage.buckets
set file_size_limit = 10485760  -- 10 MB
where id = 'form-uploads';
