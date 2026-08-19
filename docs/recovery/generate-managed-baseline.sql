-- Wilmet Lovable-managed authoritative baseline generator
-- READ ONLY: this query only reads PostgreSQL catalogs and the vehicle-photos
-- bucket configuration. It emits ordered DDL rows; it does not change the
-- authoritative Lovable-managed database.
--
-- Intended target: the authoritative Wilmet Lovable Cloud PostgreSQL database.
-- Intended use: capture a reviewed schema-only baseline for reconstruction in
-- a completely isolated Supabase environment. Never execute generated reset or
-- destructive commands against the Lovable-managed source database.
--
-- Deliberate scope:
--   * application-owned public/private schemas;
--   * required application extensions;
--   * enums, sequences, tables, constraints, indexes;
--   * application functions and non-internal public triggers;
--   * public RLS state/policies and Wilmet custom storage policies;
--   * relevant PUBLIC/anon/authenticated/service_role ACLs;
--   * vehicle-photos bucket configuration.
--
-- Deliberately excluded:
--   * customer/business rows;
--   * auth.users and Auth secrets;
--   * Storage objects/files;
--   * Supabase/Lovable internal Storage triggers/tables/functions;
--   * Lovable-only provider roles such as sandbox_exec;
--   * hosted Auth/provider configuration (separate release gate).
--
-- Preconditions currently verified for Wilmet on 2026-08-20:
--   * 52 ordinary application tables; no partitions/views/materialized views;
--   * 34 enum types; no application domains/composite/range types;
--   * 5 sequences;
--   * no identity or generated columns;
--   * no non-default collations/table storage options;
--   * 99 indexes, including 2 HNSW; no expression/partial/exclusion indexes.
--
-- If those assumptions change, review this generator before using its output.

WITH
app_tables AS (
  SELECT
    c.oid,
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relowner,
    c.relrowsecurity,
    c.relforcerowsecurity,
    c.relacl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND c.relkind = 'r'
),
app_enums AS (
  SELECT
    t.oid,
    n.nspname AS schema_name,
    t.typname AS type_name,
    t.typowner,
    t.typacl,
    string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname IN ('public', 'private')
  GROUP BY t.oid, n.nspname, t.typname, t.typowner, t.typacl
),
app_sequences AS (
  SELECT
    c.oid,
    n.nspname AS schema_name,
    c.relname AS sequence_name,
    c.relowner,
    c.relacl,
    s.seqtypid,
    s.seqstart,
    s.seqincrement,
    s.seqmax,
    s.seqmin,
    s.seqcache,
    s.seqcycle,
    dep.refobjid AS owned_table_oid,
    dep.refobjsubid AS owned_attnum
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_sequence s ON s.seqrelid = c.oid
  LEFT JOIN pg_depend dep
    ON dep.classid = 'pg_class'::regclass
   AND dep.objid = c.oid
   AND dep.deptype = 'a'
  WHERE n.nspname IN ('public', 'private')
    AND c.relkind = 'S'
),
app_functions AS (
  SELECT
    p.oid,
    n.nspname AS schema_name,
    p.proname AS function_name,
    p.proowner,
    p.proacl,
    pg_get_function_identity_arguments(p.oid) AS identity_args,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    )
),
column_lines AS (
  SELECT
    t.oid AS table_oid,
    a.attnum,
    format(
      '    %I %s%s%s',
      a.attname,
      format_type(a.atttypid, a.atttypmod),
      CASE
        WHEN ad.oid IS NOT NULL
          THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid)
        ELSE ''
      END,
      CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
    ) AS ddl
  FROM app_tables t
  JOIN pg_attribute a
    ON a.attrelid = t.oid
   AND a.attnum > 0
   AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad
    ON ad.adrelid = a.attrelid
   AND ad.adnum = a.attnum
),
table_ddl AS (
  SELECT
    t.schema_name,
    t.table_name,
    format(
      'CREATE TABLE %I.%I (\n%s\n);',
      t.schema_name,
      t.table_name,
      string_agg(c.ddl, ',\n' ORDER BY c.attnum)
    ) AS ddl
  FROM app_tables t
  JOIN column_lines c ON c.table_oid = t.oid
  GROUP BY t.schema_name, t.table_name
),
non_fk_constraints AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname,
    con.contype,
    format(
      'ALTER TABLE ONLY %I.%I ADD CONSTRAINT %I %s;',
      n.nspname,
      c.relname,
      con.conname,
      pg_get_constraintdef(con.oid, true)
    ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND con.contype IN ('p', 'u', 'c')
),
fk_constraints AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    con.conname,
    format(
      'ALTER TABLE ONLY %I.%I ADD CONSTRAINT %I %s;',
      n.nspname,
      c.relname,
      con.conname,
      pg_get_constraintdef(con.oid, true)
    ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND con.contype = 'f'
),
standalone_indexes AS (
  SELECT
    n.nspname AS schema_name,
    tbl.relname AS table_name,
    idx.relname AS index_name,
    pg_get_indexdef(i.indexrelid) || ';' AS ddl
  FROM pg_index i
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = tbl.relnamespace
  JOIN pg_class idx ON idx.oid = i.indexrelid
  WHERE n.nspname IN ('public', 'private')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conindid = i.indexrelid
    )
),
public_triggers AS (
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    t.tgname AS trigger_name,
    pg_get_triggerdef(t.oid, true) || ';' AS ddl
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND NOT t.tgisinternal
),
policy_ddl AS (
  SELECT
    p.schemaname AS schema_name,
    p.tablename AS table_name,
    p.policyname,
    format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      (
        SELECT string_agg(quote_ident(role_name), ', ' ORDER BY role_name)
        FROM unnest(p.roles) AS role_name
      ),
      CASE WHEN p.qual IS NOT NULL THEN ' USING (' || p.qual || ')' ELSE '' END,
      CASE WHEN p.with_check IS NOT NULL THEN ' WITH CHECK (' || p.with_check || ')' ELSE '' END
    ) AS ddl
  FROM pg_policies p
  WHERE p.schemaname = 'public'
     OR (
       p.schemaname = 'storage'
       AND p.policyname LIKE 'vehicle_photo_objects_%'
     )
),
relation_acl_base AS (
  SELECT
    t.schema_name,
    t.table_name AS object_name,
    'TABLE'::text AS object_kind,
    x.grantee,
    x.privilege_type,
    x.is_grantable
  FROM app_tables t
  CROSS JOIN LATERAL aclexplode(COALESCE(t.relacl, acldefault('r', t.relowner))) x
  UNION ALL
  SELECT
    s.schema_name,
    s.sequence_name,
    'SEQUENCE',
    x.grantee,
    x.privilege_type,
    x.is_grantable
  FROM app_sequences s
  CROSS JOIN LATERAL aclexplode(COALESCE(s.relacl, acldefault('S', s.relowner))) x
),
relation_acl AS (
  SELECT
    a.schema_name,
    a.object_name,
    a.object_kind,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee_name,
    a.is_grantable,
    string_agg(upper(a.privilege_type), ', ' ORDER BY a.privilege_type) AS privileges
  FROM relation_acl_base a
  LEFT JOIN pg_roles r ON r.oid = a.grantee
  WHERE a.grantee = 0
     OR r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY
    a.schema_name,
    a.object_name,
    a.object_kind,
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
    a.is_grantable
),
function_acl AS (
  SELECT
    f.schema_name,
    f.function_name,
    f.identity_args,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee_name,
    x.is_grantable,
    string_agg(upper(x.privilege_type), ', ' ORDER BY x.privilege_type) AS privileges
  FROM app_functions f
  CROSS JOIN LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) x
  LEFT JOIN pg_roles r ON r.oid = x.grantee
  WHERE x.grantee = 0
     OR r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY
    f.schema_name,
    f.function_name,
    f.identity_args,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
    x.is_grantable
),
type_acl AS (
  SELECT
    e.schema_name,
    e.type_name,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee_name,
    x.is_grantable,
    string_agg(upper(x.privilege_type), ', ' ORDER BY x.privilege_type) AS privileges
  FROM app_enums e
  CROSS JOIN LATERAL aclexplode(COALESCE(e.typacl, acldefault('T', e.typowner))) x
  LEFT JOIN pg_roles r ON r.oid = x.grantee
  WHERE x.grantee = 0
     OR r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY
    e.schema_name,
    e.type_name,
    CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
    x.is_grantable
),
emitted AS (
  SELECT 10 AS section_order, 'preamble' AS section, '000' AS object_key,
    '-- Generated from authoritative Wilmet Lovable-managed PostgreSQL catalog.\nSET search_path = public, extensions, pg_catalog;' AS ddl

  UNION ALL
  SELECT 20, 'schema', 'private', 'CREATE SCHEMA IF NOT EXISTS private;'

  UNION ALL
  SELECT
    30,
    'extension',
    e.extname,
    format(
      'CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I;',
      e.extname,
      n.nspname
    )
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname IN ('pgcrypto', 'uuid-ossp', 'vector')

  UNION ALL
  SELECT
    40,
    'enum',
    format('%s.%s', schema_name, type_name),
    format('CREATE TYPE %I.%I AS ENUM (%s);', schema_name, type_name, labels)
  FROM app_enums

  UNION ALL
  SELECT
    50,
    'sequence',
    format('%s.%s', schema_name, sequence_name),
    format(
      'CREATE SEQUENCE %I.%I AS %s INCREMENT BY %s MINVALUE %s MAXVALUE %s START WITH %s CACHE %s %s;',
      schema_name,
      sequence_name,
      format_type(seqtypid, -1),
      seqincrement,
      seqmin,
      seqmax,
      seqstart,
      seqcache,
      CASE WHEN seqcycle THEN 'CYCLE' ELSE 'NO CYCLE' END
    )
  FROM app_sequences

  UNION ALL
  SELECT
    60,
    'table',
    format('%s.%s', schema_name, table_name),
    ddl
  FROM table_ddl

  UNION ALL
  SELECT
    70,
    'sequence-ownership',
    format('%s.%s', s.schema_name, s.sequence_name),
    format(
      'ALTER SEQUENCE %I.%I OWNED BY %s.%I;',
      s.schema_name,
      s.sequence_name,
      s.owned_table_oid::regclass::text,
      a.attname
    )
  FROM app_sequences s
  JOIN pg_attribute a
    ON a.attrelid = s.owned_table_oid
   AND a.attnum = s.owned_attnum
  WHERE s.owned_table_oid IS NOT NULL

  UNION ALL
  SELECT
    80,
    'constraint',
    format('%s.%s.%s', schema_name, table_name, conname),
    ddl
  FROM non_fk_constraints

  UNION ALL
  SELECT
    90,
    'foreign-key',
    format('%s.%s.%s', schema_name, table_name, conname),
    ddl
  FROM fk_constraints

  UNION ALL
  SELECT
    100,
    'function',
    format('%s.%s(%s)', schema_name, function_name, identity_args),
    definition
  FROM app_functions

  UNION ALL
  SELECT
    110,
    'index',
    format('%s.%s', schema_name, index_name),
    ddl
  FROM standalone_indexes

  UNION ALL
  SELECT
    120,
    'trigger',
    format('%s.%s.%s', schema_name, table_name, trigger_name),
    ddl
  FROM public_triggers

  UNION ALL
  SELECT
    130,
    'rls',
    format('%s.%s', schema_name, table_name),
    format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;%s',
      schema_name,
      table_name,
      CASE
        WHEN relforcerowsecurity
          THEN format('\nALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', schema_name, table_name)
        ELSE ''
      END
    )
  FROM app_tables
  WHERE relrowsecurity

  UNION ALL
  SELECT
    140,
    'policy',
    format('%s.%s.%s', schema_name, table_name, policyname),
    ddl
  FROM policy_ddl

  UNION ALL
  SELECT
    150,
    'table-acl-reset',
    format('%s.%s', schema_name, table_name),
    format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC, anon, authenticated, service_role;',
      schema_name,
      table_name
    )
  FROM app_tables

  UNION ALL
  SELECT
    151,
    'relation-grant',
    format('%s.%s.%s.%s', schema_name, object_name, object_kind, grantee_name),
    format(
      'GRANT %s ON %s %I.%I TO %s%s;',
      privileges,
      object_kind,
      schema_name,
      object_name,
      CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
      CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    )
  FROM relation_acl
  WHERE object_kind = 'TABLE'

  UNION ALL
  SELECT
    160,
    'sequence-acl-reset',
    format('%s.%s', schema_name, sequence_name),
    format(
      'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC, anon, authenticated, service_role;',
      schema_name,
      sequence_name
    )
  FROM app_sequences

  UNION ALL
  SELECT
    161,
    'relation-grant',
    format('%s.%s.%s.%s', schema_name, object_name, object_kind, grantee_name),
    format(
      'GRANT %s ON %s %I.%I TO %s%s;',
      privileges,
      object_kind,
      schema_name,
      object_name,
      CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
      CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    )
  FROM relation_acl
  WHERE object_kind = 'SEQUENCE'

  UNION ALL
  SELECT
    170,
    'function-acl-reset',
    format('%s.%s(%s)', schema_name, function_name, identity_args),
    format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated, service_role;',
      schema_name,
      function_name,
      identity_args
    )
  FROM app_functions

  UNION ALL
  SELECT
    171,
    'function-grant',
    format('%s.%s(%s).%s', schema_name, function_name, identity_args, grantee_name),
    format(
      'GRANT %s ON FUNCTION %I.%I(%s) TO %s%s;',
      privileges,
      schema_name,
      function_name,
      identity_args,
      CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
      CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    )
  FROM function_acl

  UNION ALL
  SELECT
    180,
    'type-acl-reset',
    format('%s.%s', schema_name, type_name),
    format(
      'REVOKE ALL PRIVILEGES ON TYPE %I.%I FROM PUBLIC, anon, authenticated, service_role;',
      schema_name,
      type_name
    )
  FROM app_enums

  UNION ALL
  SELECT
    181,
    'type-grant',
    format('%s.%s.%s', schema_name, type_name, grantee_name),
    format(
      'GRANT %s ON TYPE %I.%I TO %s%s;',
      privileges,
      schema_name,
      type_name,
      CASE WHEN grantee_name = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee_name) END,
      CASE WHEN is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    )
  FROM type_acl

  UNION ALL
  SELECT
    190,
    'storage-bucket',
    b.id,
    format(
      'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %s, %L::text[]) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;',
      b.id,
      b.name,
      b.public,
      COALESCE(b.file_size_limit::text, 'NULL'),
      b.allowed_mime_types::text
    )
  FROM storage.buckets b
  WHERE b.id = 'vehicle-photos'
)
SELECT
  section_order,
  section,
  object_key,
  ddl
FROM emitted
ORDER BY section_order, object_key;
