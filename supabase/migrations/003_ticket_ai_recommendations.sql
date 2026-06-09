-- Add AI recommendations column to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_recommendations text[];

-- Create storage bucket for ticket photos (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous uploads to ticket-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'ticket_photos_insert'
  ) THEN
    EXECUTE 'CREATE POLICY ticket_photos_insert ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = ''ticket-photos'')';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'ticket_photos_select'
  ) THEN
    EXECUTE 'CREATE POLICY ticket_photos_select ON storage.objects FOR SELECT TO anon USING (bucket_id = ''ticket-photos'')';
  END IF;
END $$;
