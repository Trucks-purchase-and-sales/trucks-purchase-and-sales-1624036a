-- V2P RLS audit. Run in the Supabase SQL editor or via psql on STAGING.
-- 1) Tables in public with RLS DISABLED (each one is a potential CVE-2025-48757).
select tablename as table_without_rls
from pg_tables
where schemaname = 'public' and not rowsecurity
order by tablename;

-- 2) Every policy with its USING / WITH CHECK expression (read these by hand).
select tablename, policyname, cmd, roles,
       qual        as using_expr,
       with_check  as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Dangerous permissive policies: USING (true) or WITH CHECK (true).
select tablename, policyname, cmd, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename;

-- 4) Tables that have RLS enabled but ZERO policies (deny-all: confirm intended).
select t.tablename
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.rowsecurity and p.policyname is null
order by t.tablename;
