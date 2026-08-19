-- TM-009: profiles are provisioned by the trusted auth trigger, not by browsers.
--
-- `public.handle_new_user()` is SECURITY DEFINER owned by postgres and creates the
-- profile when an auth user is created. Allowing authenticated users to INSERT a
-- missing profile themselves lets them choose privilege-adjacent fields that the
-- UPDATE guard correctly protects later.
--
-- Fail closed: a missing profile is a provisioning/integrity incident. It must be
-- repaired by trusted server/service-role administration, never reconstructed by
-- an untrusted browser session.

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;

REVOKE INSERT ON TABLE public.profiles FROM authenticated;
REVOKE INSERT ON TABLE public.profiles FROM anon;
