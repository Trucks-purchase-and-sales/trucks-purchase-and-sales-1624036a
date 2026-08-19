-- TM-001 / #21: buyer-lead child records must inherit the parent lead scope.
--
-- The inherited policies gave every internal sales_agent global access to
-- buyer_lead_matches and buyer_lead_status_history even though buyer_leads is
-- assignment/group/staff_scope constrained. This migration keeps the previous
-- role populations while requiring authorization through the parent lead.

-- ---------------------------------------------------------------------------
-- buyer_lead_matches
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sales staff manage matches" ON public.buyer_lead_matches;
DROP POLICY IF EXISTS "Sales staff read matches" ON public.buyer_lead_matches;
DROP POLICY IF EXISTS buyer_lead_matches_select_scoped ON public.buyer_lead_matches;
DROP POLICY IF EXISTS buyer_lead_matches_insert_scoped ON public.buyer_lead_matches;
DROP POLICY IF EXISTS buyer_lead_matches_update_scoped ON public.buyer_lead_matches;
DROP POLICY IF EXISTS buyer_lead_matches_delete_scoped ON public.buyer_lead_matches;

CREATE POLICY buyer_lead_matches_select_scoped ON public.buyer_lead_matches
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_matches.buyer_lead_id
      AND private.can_read_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
      )
  )
);

CREATE POLICY buyer_lead_matches_insert_scoped ON public.buyer_lead_matches
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_matches.buyer_lead_id
      AND private.can_write_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
      )
  )
);

CREATE POLICY buyer_lead_matches_update_scoped ON public.buyer_lead_matches
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_matches.buyer_lead_id
      AND private.can_write_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_matches.buyer_lead_id
      AND private.can_write_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
      )
  )
);

CREATE POLICY buyer_lead_matches_delete_scoped ON public.buyer_lead_matches
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_matches.buyer_lead_id
      AND private.can_write_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
      )
  )
);

-- ---------------------------------------------------------------------------
-- buyer_lead_status_history
-- ---------------------------------------------------------------------------
-- Status history is trigger/audit output. Preserve read-only behavior and make
-- visibility follow the parent lead. No direct INSERT/UPDATE/DELETE policy is
-- introduced for application users.
DROP POLICY IF EXISTS "Sales staff read status history" ON public.buyer_lead_status_history;
DROP POLICY IF EXISTS buyer_lead_status_history_select_scoped ON public.buyer_lead_status_history;

CREATE POLICY buyer_lead_status_history_select_scoped ON public.buyer_lead_status_history
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
    FROM public.buyer_leads AS lead
    WHERE lead.id = buyer_lead_status_history.buyer_lead_id
      AND private.can_read_pipeline_record(
        auth.uid(),
        lead.assigned_sales_agent_id,
        lead.assigned_group_id,
        COALESCE(lead.assigned_group, 'sales'::public.staff_group)
      )
  )
);
