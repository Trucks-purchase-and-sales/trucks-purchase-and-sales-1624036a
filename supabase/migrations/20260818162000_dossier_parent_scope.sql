-- B0-009: dossier child-table authorization must inherit the parent opportunity.
--
-- The previous ALL policies granted every internal sales agent access to every
-- opportunity document/decision and also granted company_management write
-- access. That bypassed the scoped vehicle_opportunities authorization model.
--
-- Keep the existing dossier role population, but derive row access from the
-- parent opportunity and preserve Direction (company_management) as read-only.

-- ---------------------------------------------------------------------------
-- Opportunity documents
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opp_docs_internal_all ON public.opportunity_documents;
DROP POLICY IF EXISTS opp_docs_select_scoped ON public.opportunity_documents;
DROP POLICY IF EXISTS opp_docs_insert_scoped ON public.opportunity_documents;
DROP POLICY IF EXISTS opp_docs_update_scoped ON public.opportunity_documents;
DROP POLICY IF EXISTS opp_docs_delete_scoped ON public.opportunity_documents;

CREATE POLICY opp_docs_select_scoped ON public.opportunity_documents
FOR SELECT TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'company_management'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_documents.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_read_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_docs_insert_scoped ON public.opportunity_documents
FOR INSERT TO authenticated
WITH CHECK (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_documents.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_docs_update_scoped ON public.opportunity_documents
FOR UPDATE TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_documents.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
)
WITH CHECK (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_documents.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_docs_delete_scoped ON public.opportunity_documents
FOR DELETE TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_documents.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

-- ---------------------------------------------------------------------------
-- Opportunity decisions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opp_decisions_internal_all ON public.opportunity_decisions;
DROP POLICY IF EXISTS opp_decisions_select_scoped ON public.opportunity_decisions;
DROP POLICY IF EXISTS opp_decisions_insert_scoped ON public.opportunity_decisions;
DROP POLICY IF EXISTS opp_decisions_update_scoped ON public.opportunity_decisions;
DROP POLICY IF EXISTS opp_decisions_delete_scoped ON public.opportunity_decisions;

CREATE POLICY opp_decisions_select_scoped ON public.opportunity_decisions
FOR SELECT TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'company_management'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_decisions.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_read_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_decisions_insert_scoped ON public.opportunity_decisions
FOR INSERT TO authenticated
WITH CHECK (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_decisions.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_decisions_update_scoped ON public.opportunity_decisions
FOR UPDATE TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_decisions.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
)
WITH CHECK (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_decisions.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);

CREATE POLICY opp_decisions_delete_scoped ON public.opportunity_decisions
FOR DELETE TO authenticated
USING (
  private.has_any_role(auth.uid(), ARRAY[
    'admin'::public.app_role,
    'platform_admin'::public.app_role,
    'sales_manager'::public.app_role,
    'sales_agent'::public.app_role
  ])
  AND EXISTS (
    SELECT 1
    FROM public.vehicle_opportunities AS opp
    WHERE opp.id = opportunity_decisions.vehicle_opportunity_id
      AND opp.status <> 'brouillon'::public.opportunity_status
      AND private.can_write_pipeline_record(
        auth.uid(),
        opp.assigned_sales_agent_id,
        opp.assigned_group_id,
        COALESCE(opp.assigned_group, 'purchase'::public.staff_group)
      )
  )
);
