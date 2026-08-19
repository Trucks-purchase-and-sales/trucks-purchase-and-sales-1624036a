-- TM-011: vehicle photo metadata/storage access must inherit the parent opportunity state.
--
-- Read model:
-- - the seller/bringing external agent can read photos attached to their own opportunity;
-- - internal/external staff can read photos only when the non-draft parent opportunity is
--   visible through the canonical pipeline helper.
--
-- Mutation model for partner-owned photo assets:
-- - the caller must own/bring the parent opportunity;
-- - the caller must be a seller partner or external agent;
-- - the parent must still be a draft OR Wilmet must have explicitly handed control back
--   with owner_side = 'partenaire'.
--
-- Once a submitted opportunity is Wilmet-owned, the seller cannot rewrite/delete photo
-- metadata or Storage objects behind the reviewed workflow.

-- ---------------------------------------------------------------------------
-- public.vehicle_photos metadata
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS photos_select_owner_or_admin ON public.vehicle_photos;
DROP POLICY IF EXISTS photos_insert_owner ON public.vehicle_photos;
DROP POLICY IF EXISTS photos_update_owner ON public.vehicle_photos;
DROP POLICY IF EXISTS photos_delete_owner ON public.vehicle_photos;
DROP POLICY IF EXISTS vehicle_photos_select_parent_scoped ON public.vehicle_photos;
DROP POLICY IF EXISTS vehicle_photos_insert_parent_editable ON public.vehicle_photos;
DROP POLICY IF EXISTS vehicle_photos_update_parent_editable ON public.vehicle_photos;
DROP POLICY IF EXISTS vehicle_photos_delete_parent_editable ON public.vehicle_photos;

CREATE POLICY vehicle_photos_select_parent_scoped ON public.vehicle_photos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = vehicle_photos.vehicle_opportunity_id
      AND (
        opp.partenaire_id = auth.uid()
        OR (
          opp.status <> 'brouillon'::public.opportunity_status
          AND private.can_read_pipeline_record(
            auth.uid(),
            opp.assigned_sales_agent_id,
            opp.assigned_group_id,
            COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
          )
        )
      )
  )
);

CREATE POLICY vehicle_photos_insert_parent_editable ON public.vehicle_photos
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = vehicle_photos.vehicle_opportunity_id
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);

CREATE POLICY vehicle_photos_update_parent_editable ON public.vehicle_photos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = vehicle_photos.vehicle_opportunity_id
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = vehicle_photos.vehicle_opportunity_id
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);

CREATE POLICY vehicle_photos_delete_parent_editable ON public.vehicle_photos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = vehicle_photos.vehicle_opportunity_id
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);

-- ---------------------------------------------------------------------------
-- storage.objects for the private vehicle-photos bucket
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS vehicle_photos_select_owner_or_admin ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_insert_owner ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_update_owner ON storage.objects;
DROP POLICY IF EXISTS vehicle_photos_delete_owner ON storage.objects;
DROP POLICY IF EXISTS vehicle_photo_objects_select_parent_scoped ON storage.objects;
DROP POLICY IF EXISTS vehicle_photo_objects_insert_parent_editable ON storage.objects;
DROP POLICY IF EXISTS vehicle_photo_objects_update_parent_editable ON storage.objects;
DROP POLICY IF EXISTS vehicle_photo_objects_delete_parent_editable ON storage.objects;

CREATE POLICY vehicle_photo_objects_select_parent_scoped ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id::text = (storage.foldername(objects.name))[1]
      AND (
        opp.partenaire_id = auth.uid()
        OR (
          opp.status <> 'brouillon'::public.opportunity_status
          AND private.can_read_pipeline_record(
            auth.uid(),
            opp.assigned_sales_agent_id,
            opp.assigned_group_id,
            COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
          )
        )
      )
  )
);

CREATE POLICY vehicle_photo_objects_insert_parent_editable ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id::text = (storage.foldername(objects.name))[1]
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);

CREATE POLICY vehicle_photo_objects_update_parent_editable ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id::text = (storage.foldername(objects.name))[1]
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
)
WITH CHECK (
  bucket_id = 'vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id::text = (storage.foldername(objects.name))[1]
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);

CREATE POLICY vehicle_photo_objects_delete_parent_editable ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id::text = (storage.foldername(objects.name))[1]
      AND opp.partenaire_id = auth.uid()
      AND (
        (
          private.has_role(auth.uid(), 'partenaire'::public.app_role)
          AND private.get_partner_kind(auth.uid()) = 'seller'::public.partner_kind
        )
        OR private.is_external_agent(auth.uid())
      )
      AND (
        opp.status = 'brouillon'::public.opportunity_status
        OR opp.owner_side = 'partenaire'::public.opportunity_owner_side
      )
  )
);
