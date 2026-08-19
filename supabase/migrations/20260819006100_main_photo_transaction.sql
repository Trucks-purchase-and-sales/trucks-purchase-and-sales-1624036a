-- Main-photo selection is a two-step mutation and must be all-or-nothing.
-- SECURITY INVOKER preserves the existing vehicle_photos RLS boundary.
CREATE OR REPLACE FUNCTION public.set_main_vehicle_photo(
  p_opportunity_id uuid,
  p_photo_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Prove the target belongs to the requested parent and is writable before
  -- clearing the existing main flag. RLS hides non-writable submitted rows.
  PERFORM 1
  FROM public.vehicle_photos
  WHERE id = p_photo_id
    AND vehicle_opportunity_id = p_opportunity_id
  FOR UPDATE;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'photo not found or not writable';
  END IF;

  UPDATE public.vehicle_photos
     SET is_main_photo = false
   WHERE vehicle_opportunity_id = p_opportunity_id
     AND is_main_photo = true;

  UPDATE public.vehicle_photos
     SET is_main_photo = true
   WHERE id = p_photo_id
     AND vehicle_opportunity_id = p_opportunity_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'main photo update failed';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_main_vehicle_photo(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_main_vehicle_photo(uuid, uuid) TO authenticated;
