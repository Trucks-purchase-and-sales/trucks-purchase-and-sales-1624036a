-- Wilmet migration-history drift verification
-- Read-only. Safe to run against the connected staging database.
--
-- Purpose:
--   Prove that the five migrations after 20260818132646 are already reflected
--   in database state before using `supabase migration repair --status applied`.
--
-- Expected Git/Lovable revision when this evidence was authored:
--   5c02ddeec2297a14d5a61cc31d4786505a0038d8

-- ---------------------------------------------------------------------------
-- 1. Migration ledger
-- Expected before repair: latest recorded version = 20260818132646 and none of
-- the five candidate repair versions are present.
-- ---------------------------------------------------------------------------
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

SELECT
  v.version,
  EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations m
    WHERE m.version = v.version
  ) AS recorded_in_ledger
FROM (VALUES
  ('20260818142500'),
  ('20260818145500'),
  ('20260818155500'),
  ('20260818160500'),
  ('20260818162000')
) AS v(version)
ORDER BY v.version;

-- ---------------------------------------------------------------------------
-- 2. 20260818142500_vehicle_photo_bucket_hardening.sql
-- Expected:
--   public = false
--   file_size_limit = 10485760
--   allowlist = jpeg/png/webp/heic/heif
-- ---------------------------------------------------------------------------
SELECT
  id,
  public,
  file_size_limit,
  allowed_mime_types,
  (
    public = false
    AND file_size_limit = 10485760
    AND allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]::text[]
  ) AS matches_reviewed_migration
FROM storage.buckets
WHERE id = 'vehicle-photos';

-- ---------------------------------------------------------------------------
-- 3. 20260818145500_phase1b_authorization_correction.sql
-- Expected:
--   anon cannot execute pipeline helpers;
--   authenticated/service_role can execute them;
--   can_read_pipeline_record includes role-gated direct assignment.
-- ---------------------------------------------------------------------------
SELECT
  p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'private'
  AND p.proname IN (
    'can_read_all_pipeline',
    'can_write_all_pipeline',
    'is_internal_sales_agent',
    'is_external_agent',
    'staff_scope_allows',
    'can_read_pipeline_record',
    'can_write_pipeline_record'
  )
ORDER BY p.proname;

SELECT pg_get_functiondef(
  'private.can_read_pipeline_record(uuid,uuid,uuid,public.staff_group)'::regprocedure
) AS can_read_pipeline_record_definition;

-- ---------------------------------------------------------------------------
-- 4. 20260818155500_partner_workflow_integrity_guard.sql
-- Expected:
--   no legacy "Partenaire updates when owner" policy;
--   scoped partner UPDATE and draft-isolating SELECT policies;
--   BEFORE INSERT OR UPDATE seller guard trigger;
--   reviewed state-machine function definition.
-- ---------------------------------------------------------------------------
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'vehicle_opportunities'
ORDER BY policyname;

SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'vehicle_opportunities'
  AND t.tgname = 'trg_opp_partner_column_guard'
  AND NOT t.tgisinternal;

SELECT pg_get_functiondef(
  'public.tg_opp_partner_column_guard()'::regprocedure
) AS opportunity_partner_guard_definition;

-- ---------------------------------------------------------------------------
-- 5. 20260818160500_profile_self_update_guard.sql
-- Expected:
--   BEFORE UPDATE trigger on public.profiles;
--   guard function protects identity/account/authz/commission/referral fields.
-- ---------------------------------------------------------------------------
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND t.tgname = 'trg_profile_self_update_guard'
  AND NOT t.tgisinternal;

SELECT pg_get_functiondef(
  'public.tg_profile_self_update_guard()'::regprocedure
) AS profile_self_update_guard_definition;

-- ---------------------------------------------------------------------------
-- 6. 20260818162000_dossier_parent_scope.sql
-- Expected:
--   no broad *_internal_all policy;
--   four scoped policies on opportunity_documents;
--   four scoped policies on opportunity_decisions;
--   company_management present only in SELECT role predicate;
--   write policies derive scope from can_write_pipeline_record(...).
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('opportunity_documents', 'opportunity_decisions')
ORDER BY tablename, policyname;

-- ---------------------------------------------------------------------------
-- 7. Compact structural assertions
-- These do not replace reviewing the definitions above, but make accidental
-- omissions easy to spot in captured evidence.
-- ---------------------------------------------------------------------------
SELECT
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_opportunities'
      AND policyname = 'Partenaire updates when owner'
  ) AS legacy_partner_update_policy_absent,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'vehicle_opportunities'
      AND t.tgname = 'trg_opp_partner_column_guard'
      AND NOT t.tgisinternal
  ) AS partner_guard_trigger_present,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND t.tgname = 'trg_profile_self_update_guard'
      AND NOT t.tgisinternal
  ) AS profile_guard_trigger_present,
  (
    SELECT count(*) = 4
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_documents'
      AND policyname LIKE 'opp_docs_%_scoped'
  ) AS document_scoped_policy_set_complete,
  (
    SELECT count(*) = 4
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'opportunity_decisions'
      AND policyname LIKE 'opp_decisions_%_scoped'
  ) AS decision_scoped_policy_set_complete,
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('opp_docs_internal_all', 'opp_decisions_internal_all')
  ) AS legacy_dossier_all_policies_absent;

-- After a supported CLI repair, rerun this file.
-- The application/security objects above must be unchanged, while the five
-- candidate versions in section 1 must change from false to true.
