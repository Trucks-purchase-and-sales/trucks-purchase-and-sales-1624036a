-- Wilmet managed recovery baseline
-- Capture date: 2026-08-20
-- Source Git SHA: 876a86aa6c83d31b1c3146227346d3d77aa640ac
-- Source migration head: 20260819163158 app_settings_private_boundary
-- Source PostgreSQL: 17.6
--
-- ISOLATED RECOVERY TARGET ONLY.
-- This script intentionally fails closed if the disposable target is not a
-- Supabase-style PostgreSQL 17 environment with the provider schemas/roles that
-- Wilmet depends on. Never run this baseline against the authoritative
-- Lovable-managed Wilmet database.

DO $$
DECLARE
  server_major integer := current_setting('server_version_num')::integer / 10000;
  required_role text;
BEGIN
  IF server_major <> 17 THEN
    RAISE EXCEPTION
      'Wilmet baseline captured from PostgreSQL 17; isolated recovery target is PostgreSQL %',
      server_major;
  END IF;

  FOREACH required_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required_role) THEN
      RAISE EXCEPTION 'Missing required Supabase role: %', required_role;
    END IF;
  END LOOP;

  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Missing provider-managed auth.users table';
  END IF;

  IF to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Missing provider-managed Supabase Storage tables';
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS private;

-- Reproduce the application-visible schema privilege boundary. The source
-- project grants USAGE (but not CREATE) on public to application roles and no
-- USAGE/CREATE on private to those roles.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

SET search_path = public, extensions, pg_catalog;
