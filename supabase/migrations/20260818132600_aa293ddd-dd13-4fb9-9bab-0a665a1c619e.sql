-- RLS predicates are evaluated as the querying role: it must be able to execute the helpers.
GRANT EXECUTE ON FUNCTION private.can_read_all_pipeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_write_all_pipeline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_internal_sales_agent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_external_agent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_read_all_pipeline(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_write_all_pipeline(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_internal_sales_agent(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_external_agent(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) TO service_role;
GRANT EXECUTE ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) TO service_role;