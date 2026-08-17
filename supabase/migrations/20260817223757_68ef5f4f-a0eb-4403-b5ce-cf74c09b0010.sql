-- FIND-001: ensure new signups get a profile + role, and backfill existing accounts.
-- Idempotent: safe to re-apply. Only touches the on_auth_user_created trigger.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles, mirroring handle_new_user() semantics.
INSERT INTO public.profiles (
  id, email, first_name, last_name, phone, company_name, provider_type,
  city, country, partner_kind, referred_by, referral_code
)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'first_name', ''),
  COALESCE(u.raw_user_meta_data->>'last_name', ''),
  u.raw_user_meta_data->>'phone',
  u.raw_user_meta_data->>'company_name',
  NULLIF(u.raw_user_meta_data->>'provider_type','')::public.provider_type,
  u.raw_user_meta_data->>'city',
  COALESCE(u.raw_user_meta_data->>'country','France'),
  CASE WHEN u.raw_user_meta_data->>'partner_kind' IN ('client','seller')
       THEN (u.raw_user_meta_data->>'partner_kind')::public.partner_kind
       ELSE 'client'::public.partner_kind END,
  l.owner_id,
  CASE WHEN l.owner_id IS NOT NULL THEN upper(NULLIF(trim(u.raw_user_meta_data->>'referral_code'), '')) END
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT al.owner_id
  FROM public.affiliate_links al
  WHERE al.is_active
    AND upper(al.code) = upper(NULLIF(trim(u.raw_user_meta_data->>'referral_code'), ''))
    AND al.owner_id <> u.id
  LIMIT 1
) l ON true
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Backfill missing roles: external accounts default to 'partenaire'.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'partenaire'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;