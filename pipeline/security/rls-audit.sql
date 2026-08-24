-- V2P RLS audit. Run in the Supabase SQL editor or via psql on STAGING.
--
-- Scoped to ('public', 'storage'), not just 'public': a live run of this
-- app's real staging environment caught that Supabase Storage access is
-- enforced via RLS policies on storage.objects (a different schema
-- entirely) — a table-driven app can easily have a bucket whose access
-- policies were never independently checked if this audit only looks at
-- 'public'. Add any other schema your app's tables/policies live in.

-- 1) Tables with RLS DISABLED (each one is a potential CVE-2025-48757).
select schemaname, tablename as table_without_rls
from pg_tables
where schemaname in ('public', 'storage') and not rowsecurity
order by schemaname, tablename;

-- 2) Every policy with its USING / WITH CHECK expression (read these by hand).
select schemaname, tablename, policyname, cmd, roles,
       qual        as using_expr,
       with_check  as with_check_expr
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 3) Dangerous permissive policies: USING (true) or WITH CHECK (true).
select schemaname, tablename, policyname, cmd, qual as using_expr, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and (qual = 'true' or with_check = 'true')
order by schemaname, tablename;

-- 4) Tables that have RLS enabled but ZERO policies (deny-all: confirm intended).
select t.schemaname, t.tablename
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname in ('public', 'storage') and t.rowsecurity and p.policyname is null
order by t.schemaname, t.tablename;
