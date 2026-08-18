-- FIND-003: allow public buyer-lead submissions to read back only their own reference number,
-- and expose the rate-limit helper on a schema the API can actually reach.

CREATE OR REPLACE FUNCTION public.buyer_lead_reference(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT reference_number FROM public.buyer_leads WHERE id = p_id
$$;

REVOKE ALL ON FUNCTION public.buyer_lead_reference(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_lead_reference(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_check(
  _bucket text, _key_hash text, _window_seconds integer, _max_events integer
)
RETURNS TABLE(allowed boolean, current_count integer, retry_after_seconds integer)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM private.rate_limit_check(_bucket, _key_hash, _window_seconds, _max_events)
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, integer) TO service_role;