-- Phase 1 security hardening (B0-002): enforce upload limits at the storage boundary.
-- The browser may compress images for UX, but client-side controls are not a security boundary.

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760, -- 10 MiB per object
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
WHERE id = 'vehicle-photos';
