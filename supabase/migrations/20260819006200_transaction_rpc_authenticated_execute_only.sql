-- Supabase default function ACLs in the Wilmet project grant EXECUTE directly
-- to anon/authenticated/service_role. The preceding migrations revoke PUBLIC,
-- but that does not remove an explicit anon grant. These workflow RPCs are
-- authenticated mutations, so remove anonymous execute permission explicitly.

REVOKE ALL ON FUNCTION public.answer_information_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.answer_information_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.answer_information_request(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_request_information(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_request_information(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_request_information(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_handover_to_partner(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_handover_to_partner(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_handover_to_partner(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reorder_vehicle_photos(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_vehicle_photos(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.reorder_vehicle_photos(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.set_main_vehicle_photo(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_main_vehicle_photo(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_main_vehicle_photo(uuid, uuid) TO authenticated;
