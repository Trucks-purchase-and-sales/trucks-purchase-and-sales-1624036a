-- Align execute privileges with the existing private helpers (schema is not exposed via the API).
GRANT EXECUTE ON FUNCTION private.can_read_all_pipeline(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_write_all_pipeline(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_internal_sales_agent(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_external_agent(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.staff_scope_allows(uuid, public.staff_group) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_read_pipeline_record(uuid, uuid, uuid, public.staff_group) TO PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_write_pipeline_record(uuid, uuid, uuid, public.staff_group) TO PUBLIC;