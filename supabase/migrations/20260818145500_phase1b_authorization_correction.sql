-- Phase 1B corrective migration: enforce role-gated direct assignment and least-privilege helper grants.
-- Forward-only: do not edit or depend on rewriting previously applied migrations.

CREATE OR REPLACE FUNCTION private.can_read_pipeline_record(
  _user_id uuid,
  _assigned uuid,
  _group_id uuid,
  _side public.staff_group
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.can_read_all_pipeline(_user_id)
      OR (
        _assigned IS NOT NULL
        AND _assigned = _user_id
        AND (
          private.is_internal_sales_agent(_user_id)
          OR private.is_external_agent(_user_id)
        )
      )
      OR (
        private.is_internal_sales_agent(_user_id)
        AND (
          private.is_group_member(_user_id, _group_id)
          OR (
            _assigned IS NULL
            AND _group_id IS NULL
            AND private.staff_scope_allows(_user_id, _side)
          )
        )
      );
$$;

-- The helpers are an internal RLS implementation detail. Anonymous callers do not
-- need to execute them; authenticated users do because core RLS policies invoke them.
REVOKE ALL ON FUNCTION private.can_read_all_pipeline(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_write_all_pipeline(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_internal_sales_agent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_external_agent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.can_read_all_pipeline(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_write_all_pipeline(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_internal_sales_agent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_external_agent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) TO authenticated, service_role;
