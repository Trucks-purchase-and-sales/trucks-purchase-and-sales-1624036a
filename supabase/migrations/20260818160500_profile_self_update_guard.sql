-- B0-008: authenticated users may update their own profile row, but self-service
-- profile editing must not include authorization, commission, referral, account
-- state, or identity fields.
--
-- The UI already edits only benign contact/profile fields. This trigger moves
-- that assumption into PostgreSQL so a direct PostgREST caller cannot bypass it.

CREATE OR REPLACE FUNCTION public.tg_profile_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Trusted server-only administration (account enable/disable, staff setup,
  -- referral administration, etc.) uses the service role and remains allowed.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- RLS already requires id = auth.uid() for self updates. Keep an explicit
  -- invariant here as defense in depth and to make the trust boundary obvious.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile: id is immutable';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profile: email is managed by authentication workflows';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'profile: account state is admin-managed';
  END IF;

  IF NEW.partner_kind IS DISTINCT FROM OLD.partner_kind THEN
    RAISE EXCEPTION 'profile: partner kind is fixed outside self-service editing';
  END IF;

  IF NEW.staff_scope IS DISTINCT FROM OLD.staff_scope THEN
    RAISE EXCEPTION 'profile: staff scope is admin-managed';
  END IF;

  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    RAISE EXCEPTION 'profile: commission rate is admin-managed';
  END IF;

  IF NEW.is_external IS DISTINCT FROM OLD.is_external THEN
    RAISE EXCEPTION 'profile: external staff metadata is admin-managed';
  END IF;

  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'profile: referral attribution is immutable in self-service editing';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'profile: created_at is immutable';
  END IF;

  -- `updated_at` is intentionally not compared: the existing BEFORE UPDATE
  -- timestamp trigger owns it. Benign self-service fields remain editable:
  -- first_name, last_name, phone, company_name, provider_type, city, country,
  -- preferred_locale.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_self_update_guard ON public.profiles;
CREATE TRIGGER trg_profile_self_update_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profile_self_update_guard();
