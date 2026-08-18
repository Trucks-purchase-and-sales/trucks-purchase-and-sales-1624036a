-- FIND-003 verification follow-up: the rate-limit helper must only ever be usable by the
-- server (service role). Table-level EXECUTE grants are re-applied automatically to the
-- public API roles, so enforce the caller's role inside the function itself.
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  _bucket text, _key_hash text, _window_seconds integer, _max_events integer
)
RETURNS TABLE(allowed boolean, current_count integer, retry_after_seconds integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true),
              (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
              current_user) <> 'service_role' THEN
    RAISE EXCEPTION 'rate_limit_check is restricted to server-side callers'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM private.rate_limit_check(_bucket, _key_hash, _window_seconds, _max_events);
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, integer) TO service_role;