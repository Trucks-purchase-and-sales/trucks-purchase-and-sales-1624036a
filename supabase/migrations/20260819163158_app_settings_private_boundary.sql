-- TM-008: app_settings is a generic operational settings table. Direct
-- anonymous/authenticated read access makes every future key public by default.
-- Keep the table itself behind admin RLS and expose only explicit server-side
-- projections for the public assistant and authenticated AI feature flags.

DROP POLICY IF EXISTS "app_settings readable by everyone" ON public.app_settings;
DROP POLICY IF EXISTS app_settings_admin_read ON public.app_settings;

CREATE POLICY app_settings_admin_read
ON public.app_settings
FOR SELECT TO authenticated
USING (
  private.has_any_role(
    auth.uid(),
    ARRAY['admin'::public.app_role, 'platform_admin'::public.app_role]
  )
);

REVOKE ALL ON TABLE public.app_settings FROM anon;
REVOKE ALL ON TABLE public.app_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_settings TO authenticated;
