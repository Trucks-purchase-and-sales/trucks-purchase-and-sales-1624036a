-- Production reliability: multi-step workflow mutations must be atomic.
--
-- These RPCs are SECURITY INVOKER so normal RLS remains the authorization boundary.
-- The functions add transaction semantics and row-count assertions; they do not bypass
-- the parent opportunity or child-resource policies.

-- ---------------------------------------------------------------------------
-- Seller answers an information request and returns the parent to Wilmet atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.answer_information_request(
  p_request_id uuid,
  p_response text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_opportunity_id uuid;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  UPDATE public.information_requests
     SET status = 'answered'::public.info_request_status,
         response = NULLIF(btrim(p_response), '')
   WHERE id = p_request_id
   RETURNING vehicle_opportunity_id INTO v_opportunity_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 OR v_opportunity_id IS NULL THEN
    RAISE EXCEPTION 'information request not found or not writable';
  END IF;

  UPDATE public.vehicle_opportunities
     SET status = 'envoyee'::public.opportunity_status
   WHERE id = v_opportunity_id
     AND partenaire_id = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'parent opportunity not writable';
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Trusted admin requests information without handing edit control to the seller.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_request_information(
  p_opportunity_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request_id uuid;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NULLIF(btrim(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'message required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'platform_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  INSERT INTO public.information_requests (
    vehicle_opportunity_id,
    admin_id,
    message
  ) VALUES (
    p_opportunity_id,
    auth.uid(),
    btrim(p_message)
  )
  RETURNING id INTO v_request_id;

  UPDATE public.vehicle_opportunities
     SET status = 'en_cours_analyse'::public.opportunity_status
   WHERE id = p_opportunity_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'parent opportunity not writable';
  END IF;

  RETURN v_request_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Trusted admin hands the parent back and records the request in one transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_handover_to_partner(
  p_opportunity_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_request_id uuid;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NULLIF(btrim(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'message required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::public.app_role, 'platform_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  UPDATE public.vehicle_opportunities
     SET owner_side = 'partenaire'::public.opportunity_owner_side,
         status = 'en_cours_analyse'::public.opportunity_status,
         handover_message = btrim(p_message)
   WHERE id = p_opportunity_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'parent opportunity not writable';
  END IF;

  INSERT INTO public.information_requests (
    vehicle_opportunity_id,
    admin_id,
    message
  ) VALUES (
    p_opportunity_id,
    auth.uid(),
    btrim(p_message)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Photo ordering must be all-or-nothing; one inaccessible/missing row aborts all.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_vehicle_photos(p_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order record;
  v_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_orders IS NULL OR jsonb_typeof(p_orders) <> 'array' THEN
    RAISE EXCEPTION 'orders must be a JSON array';
  END IF;
  IF jsonb_array_length(p_orders) = 0 THEN
    RETURN;
  END IF;
  IF jsonb_array_length(p_orders) > 50 THEN
    RAISE EXCEPTION 'too many photo orders';
  END IF;
  IF EXISTS (
    SELECT parsed.id
    FROM jsonb_to_recordset(p_orders) AS parsed(id uuid, sort_order integer)
    GROUP BY parsed.id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate photo id';
  END IF;

  FOR v_order IN
    SELECT parsed.id, parsed.sort_order
    FROM jsonb_to_recordset(p_orders) AS parsed(id uuid, sort_order integer)
  LOOP
    IF v_order.id IS NULL OR v_order.sort_order IS NULL OR v_order.sort_order < 0 THEN
      RAISE EXCEPTION 'invalid photo order';
    END IF;

    UPDATE public.vehicle_photos
       SET sort_order = v_order.sort_order
     WHERE id = v_order.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION 'photo not found or not writable: %', v_order.id;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.answer_information_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_request_information(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_handover_to_partner(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_vehicle_photos(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.answer_information_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_request_information(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_handover_to_partner(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_vehicle_photos(jsonb) TO authenticated;
