-- TM-007: prevent sale listings from referencing vehicle photos that do not
-- belong to the listing's source opportunity. The public catalogue resolves
-- these photo IDs with a privileged server client and signs private Storage
-- paths, so ownership must be enforced before the IDs are persisted.

CREATE OR REPLACE FUNCTION private.tg_sale_listing_photo_ownership_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF COALESCE(pg_catalog.cardinality(NEW.photo_ids), 0) = 0 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(NEW.photo_ids) AS requested(photo_id)
    LEFT JOIN public.vehicle_photos AS vp
      ON vp.id = requested.photo_id
    WHERE vp.id IS NULL
       OR vp.vehicle_opportunity_id IS DISTINCT FROM NEW.vehicle_opportunity_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'sale_listing photo_ids must belong to the source opportunity';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.tg_sale_listing_photo_ownership_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.tg_sale_listing_photo_ownership_guard() FROM anon;
REVOKE ALL ON FUNCTION private.tg_sale_listing_photo_ownership_guard() FROM authenticated;
REVOKE ALL ON FUNCTION private.tg_sale_listing_photo_ownership_guard() FROM service_role;

CREATE TRIGGER trg_sale_listing_photo_ownership_guard
BEFORE INSERT OR UPDATE ON public.sale_listings
FOR EACH ROW
EXECUTE FUNCTION private.tg_sale_listing_photo_ownership_guard();
